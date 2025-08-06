import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {throttle} from '@ryanatkn/belt/throttle.js';

import type {Plugin} from './plugin.ts';
import type {Args} from './args.ts';
import {paths} from './paths.ts';
import {find_genfiles, is_gen_path} from './gen.ts';
import {spawn_cli} from './cli.ts';

export interface Task_Args extends Args {
	watch?: boolean;
}

export interface Gro_Plugin_Gen_Options {
	/**
	 * Paths to search for gen files to process.
	 * @default [paths.source]
	 */
	input_paths?: Array<string>;
	/**
	 * Root directories for resolving gen file imports and dependencies.
	 * @default [paths.source]
	 */
	root_dirs?: Array<string>;
	/**
	 * Milliseconds to throttle gen rebuilds.
	 * Should be longer than it takes to generate to avoid backpressure.
	 * @default 500
	 */
	flush_debounce_delay?: number;
}

export const gro_plugin_gen = ({
	input_paths = [paths.source],
	root_dirs = [paths.source],
	flush_debounce_delay = 500,
}: Gro_Plugin_Gen_Options = EMPTY_OBJECT): Plugin => {
	const queued_files: Set<string> = new Set();
	let unsubscribe: (() => void) | undefined;

	// Throttled gen execution to batch multiple changes
	const flush_gen_queue = throttle(
		async () => {
			const files = Array.from(queued_files);
			queued_files.clear();
			await gen(files);
		},
		{delay: flush_debounce_delay},
	);

	// Queue a gen file for regeneration
	const queue_gen = (gen_file_id: string) => {
		queued_files.add(gen_file_id);
		void flush_gen_queue();
	};

	// Execute gen command (TODO: do this in-process eventually)
	const gen = (files: Array<string> = []) => spawn_cli('gro', ['gen', ...files]);

	return {
		name: 'gro_plugin_gen',
		setup: async ({watch, dev, log, config, filer}) => {
			// For production builds, we assume `gen` is already fresh,
			// which should be checked by CI via `gro check` which calls `gro gen --check`.
			if (!dev) return;

			// Run gen once and exit for non-watch mode
			if (!watch) {
				log.info('generating and exiting early');

				// Run `gen`, first checking if there are any modules to avoid a console error.
				// Some parts of the build may have already happened,
				// making us miss `build` events for gen dependencies,
				// so we run `gen` here even if it's usually wasteful.
				const found = find_genfiles(input_paths, root_dirs, config);
				if (found.ok && found.value.resolved_input_files.length > 0) {
					await gen();
				}
				return;
			}

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			unsubscribe = filer.observe({
				id: 'gro_plugin_gen',

				// Match any file that could affect gen files
				match: (node) => {
					// Direct gen files
					if (is_gen_path(node.id)) return true;

					// Check if any dependents are gen files
					for (const dependent_id of node.dependents.keys()) {
						if (is_gen_path(dependent_id)) return true;
					}

					return false;
				},

				// Track dependencies to catch changes in imported files
				expand_to: 'dependents',

				// Need contents to parse imports
				needs_contents: true,

				// Run early to generate before other builds
				phase: 'pre',
				priority: 100,

				// Don't track external files or directories
				track_external: false,
				track_directories: false,

				// Handle errors gracefully
				on_error: (error, batch) => {
					log.error('[gro_plugin_gen] Observer error:', error, batch);
					return 'continue'; // Don't abort other observers
				},

				// Process changes
				on_change: (batch) => {
					// Queue all gen files that need regeneration
					for (const node of batch.all_disknodes) {
						if (is_gen_path(node.id)) {
							queue_gen(node.id);
						}
					}

					// Also check if any updated files have gen file dependents
					for (const node of batch.updated) {
						// Use filer's built-in dependent filtering
						const dependent_gen_files = filer.filter_dependents(
							node,
							is_gen_path,
							true, // recursive
						);

						for (const dependent_id of dependent_gen_files) {
							queue_gen(dependent_id);
						}
					}

					// Check deleted files' former dependents
					for (const deleted_id of batch.deleted) {
						const deleted_node = filer.get_by_id(deleted_id);
						if (deleted_node) {
							const dependent_gen_files = filer.filter_dependents(deleted_node, is_gen_path, true);

							for (const dependent_id of dependent_gen_files) {
								queue_gen(dependent_id);
							}
						}
					}
				},
			});
		},

		teardown: () => {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = undefined;
			}

			// Clear any pending gen operations
			queued_files.clear();
		},
	};
};
