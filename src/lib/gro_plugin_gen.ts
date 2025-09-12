import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {throttle} from '@ryanatkn/belt/throttle.js';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';

import type {Plugin} from './plugin.ts';
import type {Args} from './args.ts';
import {paths} from './paths.ts';
import {find_genfiles, is_gen_path} from './gen.ts';
import {spawn_cli} from './cli.ts';
import {filter_dependents} from './filer.ts';

const FLUSH_DEBOUNCE_DELAY = 500;

export interface Task_Args extends Args {
	watch?: boolean;
}

export interface Gro_Plugin_Gen_Options {
	input_paths?: Array<string>;
	root_dirs?: Array<string>;
	flush_debounce_delay?: number;
}

export const gro_plugin_gen = ({
	input_paths = [paths.source],
	root_dirs = [paths.source],
	flush_debounce_delay = FLUSH_DEBOUNCE_DELAY,
}: Gro_Plugin_Gen_Options = EMPTY_OBJECT): Plugin => {
	let flushing_timeout: NodeJS.Timeout | undefined;
	const queued_files: Set<string> = new Set();
	const queue_gen = (gen_file_id: string) => {
		queued_files.add(gen_file_id);
		if (flushing_timeout === undefined) {
			flushing_timeout = setTimeout(() => {
				flushing_timeout = undefined;
				void flush_gen_queue();
			}); // the timeout batches synchronously
		}
	};
	const flush_gen_queue = throttle(
		async () => {
			const files = Array.from(queued_files);
			queued_files.clear();
			await gen(files);
		},
		{delay: flush_debounce_delay},
	);

	// TODO do this in-process - will it cause caching issues with the current impl?
	const gen = (files: Array<string> = []) => spawn_cli('gro', ['gen', ...files]);

	let cleanup_watch: (() => void) | undefined;

	return {
		name: 'gro_plugin_gen',
		setup: async ({watch, dev, log, config, filer}) => {
			// For production builds, we assume `gen` is already fresh,
			// which should be checked by CI via `gro check` which calls `gro gen --check`.
			if (!dev) return;

			// Do we need to just generate everything once and exit?
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
			cleanup_watch = await filer.watch((change, source_file) => {
				if (source_file.external) return;
				switch (change.type) {
					case 'add':
					case 'update': {
						if (is_gen_path(source_file.id)) {
							queue_gen(source_file.id);
						}
						const dependent_gen_file_ids = filter_dependents(
							source_file,
							filer.get_by_id,
							is_gen_path,
							undefined,
							undefined,
							log,
						);
						for (const dependent_gen_file_id of dependent_gen_file_ids) {
							queue_gen(dependent_gen_file_id);
						}
						break;
					}
					case 'delete': {
						// TODO delete the generated file(s)? option? because it may be surprising
						break;
					}
					default:
						throw new Unreachable_Error(change.type);
				}
			});
		},
		teardown: async () => {
			if (cleanup_watch) {
				await cleanup_watch();
				cleanup_watch = undefined;
			}
		},
	};
};
