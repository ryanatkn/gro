// @ts-nocheck
import {spawn} from '@feltjs/util/process.js';

import type {FilerEvents} from '../build/Filer.js';
import type {Plugin, PluginContext} from './plugin.js';
import type {Args} from '../task/args.js';
import {source_id_to_base_path} from '../path/paths.js';
import {find_gen_modules, is_gen_path} from '../gen/gen_module.js';
import {filter_dependents} from '../build/source_file.js';
import {throttle} from '../util/throttle.js';

// TODO this became unused with https://github.com/grogarden/gro/pull/382
// because we no longer have a normal system build - replace with an esbuild plugin

const FLUSH_DEBOUNCE_DELAY = 500;

export interface TaskArgs extends Args {
	watch?: boolean;
}

export const create_plugin = (): Plugin<PluginContext<TaskArgs, object>> => {
	let generating = false;
	let regen = false;
	let on_filer_build: ((e: FilerEvents['build']) => void) | undefined;
	const queued_files: Set<string> = new Set();
	const queue_gen = (gen_file_name: string) => {
		queued_files.add(gen_file_name);
		void flush_gen_queue();
	};
	const flush_gen_queue = throttle(
		async () => {
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
		},
		undefined,
		FLUSH_DEBOUNCE_DELAY,
	);
	const gen = (files: string[] = []) => spawn('npx', ['gro', 'gen', ...files]);

	return {
		name: 'gro_plugin_gen',
		setup: async ({args: {watch}, dev, log}) => {
			// For production builds, we assume `gen` is already fresh,
			// which should be checked by CI via `gro check` which calls `gro gen --check`.
			if (!dev) return;

			// Run `gen`, first checking if there are any modules to avoid a console error.
			// Some parts of the build may have already happened,
			// making us miss `build` events for gen dependencies,
			// so we run `gen` here even if it's usually wasteful.
			const found = await find_gen_modules();
			if (found.ok && found.source_ids_by_input_path.size > 0) {
				await gen();
			}

			// Do we need to just generate everything once and exit?
			// TODO could we have an esbuild context here? problem is watching the right files, maybe a plugin that tracks deps
			if (!filer || !watch) {
				log.info('generating and exiting early');
				return;
			}

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			on_filer_build = async ({source_file, build_config}) => {
				// TODO how to handle this now? the loader traces deps for us with `parentPath`,
				// but we probably want to make this an esbuild plugin instead
				// if (build_config.name !== 'system') return;
				if (is_gen_path(source_file.id)) {
					queue_gen(source_id_to_base_path(source_file.id));
				}
				const dependent_gen_file_ids = filter_dependents(
					source_file,
					build_config,
					filer.find_by_id as any, // cast because we can assume they're all `SourceFile`s
					is_gen_path,
				);
				for (const dependent_gen_file_id of dependent_gen_file_ids) {
					queue_gen(source_id_to_base_path(dependent_gen_file_id));
				}
			};
			filer.on('build', on_filer_build);
		},
		teardown: async ({filer}) => {
			if (on_filer_build && filer) {
				filer.off('build', on_filer_build);
			}
		},
	};
};
