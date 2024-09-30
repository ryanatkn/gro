import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';

import type {Plugin} from './plugin.js';
import type {Args} from './args.js';
import {path_id_to_base_path, paths} from './paths.js';
import {find_genfiles, is_gen_path} from './gen.js';
import {throttle} from './throttle.js';
import {spawn_cli} from './cli.js';
import type {File_Filter, Path_Id} from './path.js';
import type {Cleanup_Watch, Source_File} from './filer.js';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';

const FLUSH_DEBOUNCE_DELAY = 500;

export interface Task_Args extends Args {
	watch?: boolean;
}

export interface Options {
	root_dirs?: string[];
	flush_debounce_delay?: number;
}

export const gro_plugin_gen = ({
	root_dirs = [paths.source],
	flush_debounce_delay = FLUSH_DEBOUNCE_DELAY,
}: Options = EMPTY_OBJECT): Plugin => {
	let generating = false;
	let regen = false;
	const queued_files: Set<string> = new Set();
	const queue_gen = (gen_file_name: string) => {
		queued_files.add(gen_file_name);
		void flush_gen_queue();
	};
	const flush_gen_queue = throttle(async () => {
		// hacky way to avoid concurrent `gro gen` calls
		if (generating) {
			regen = true;
			return;
		}
		generating = true;
		const files = Array.from(queued_files);
		queued_files.clear();
		await gen(files);
		generating = false;
		if (regen) {
			regen = false;
			void flush_gen_queue();
		}
	}, flush_debounce_delay);
	const gen = (files: string[] = []) => spawn_cli('gro', ['gen', ...files]);

	let cleanup: Cleanup_Watch | undefined;

	return {
		name: 'gro_plugin_gen',
		setup: async ({watch, dev, log, config, filer}) => {
			// For production builds, we assume `gen` is already fresh,
			// which should be checked by CI via `gro check` which calls `gro gen --check`.
			if (!dev) return;

			// Run `gen`, first checking if there are any modules to avoid a console error.
			// Some parts of the build may have already happened,
			// making us miss `build` events for gen dependencies,
			// so we run `gen` here even if it's usually wasteful.
			const found = find_genfiles([paths.source], root_dirs, config);
			if (found.ok && found.value.resolved_input_files.length > 0) {
				await gen();
			}

			// Do we need to just generate everything once and exit?
			// TODO could we have an esbuild context here? problem is watching the right files, maybe a plugin that tracks deps
			if (!watch) {
				log.info('generating and exiting early');
				return;
			}

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			console.log('CREATING WATCHER');
			cleanup = await filer.watch((change, source_file) => {
				console.log(
					`[gro_plugin_gen]`,
					change.type,
					change.path,
					source_file.id,
					source_file.dependents.size,
				);
				switch (change.type) {
					case 'add':
					case 'update': {
						// TODO how to handle this now? the loader traces deps for us with `parentPath`,
						// but we probably want to make this an esbuild plugin instead
						if (is_gen_path(source_file.id)) {
							queue_gen(path_id_to_base_path(source_file.id));
						}
						const dependent_gen_file_ids = filter_dependents(
							source_file,
							filer.get_by_id,
							is_gen_path,
						);
						// TODO BLOCK need to check all of the last-generated files too, their imports may be different, but do this after regenerating above as needed
						for (const dependent_gen_file_id of dependent_gen_file_ids) {
							queue_gen(path_id_to_base_path(dependent_gen_file_id));
						}
						break;
					}
					case 'delete': {
						// TODO delete the generated file(s)? option?
						break;
					}
					default:
						throw new Unreachable_Error(change.type);
				}
			});
		},
		teardown: async () => {
			if (cleanup !== undefined) {
				await cleanup();
				cleanup = undefined;
			}
		},
	};
};

export const filter_dependents = (
	source_file: Source_File,
	get_by_id: (id: Path_Id) => Source_File | undefined,
	filter?: File_Filter,
	results: Set<string> = new Set(),
	searched: Set<string> = new Set(),
): Set<string> => {
	const {dependents} = source_file;
	for (const dependent_id of dependents.keys()) {
		if (searched.has(dependent_id)) continue;
		searched.add(dependent_id);
		if (!filter || filter(dependent_id)) {
			results.add(dependent_id);
		}
		const dependent_source_File = get_by_id(dependent_id)!;
		filter_dependents(dependent_source_File, get_by_id, filter, results, searched);
	}
	return results;
};
