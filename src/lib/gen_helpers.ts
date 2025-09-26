import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Timings} from '@ryanatkn/belt/timings.js';

import type {Gro_Config} from './gro_config.ts';
import type {Filer} from './filer.ts';
import type {Invoke_Task} from './task.ts';
import {
	normalize_gen_config,
	validate_gen_module,
	type Gen_Context,
	type Gen_Dependencies,
} from './gen.ts';
import {default_svelte_config} from './svelte_config.ts';
import {to_root_path} from './paths.ts';
import type {Path_Id} from './path.ts';

/**
 * Check if a file change should trigger a gen file.
 */
export const should_trigger_gen = async (
	gen_file_id: Path_Id,
	changed_file_id: Path_Id,
	config: Gro_Config,
	filer: Filer,
	log: Logger,
	timings: Timings,
	invoke_task: Invoke_Task,
	dependencies_cache: Map<Path_Id, Gen_Dependencies | null>,
): Promise<boolean> => {
	// Always trigger if the gen file itself changed
	if (gen_file_id === changed_file_id) {
		// Invalidate cache for this gen file
		dependencies_cache.delete(gen_file_id);
		return true;
	}

	let dependencies: Gen_Dependencies | null | undefined;
	if (!dependencies_cache.has(gen_file_id)) {
		dependencies = await resolve_gen_dependencies(
			gen_file_id,
			config,
			filer,
			log,
			timings,
			invoke_task,
		);
		dependencies_cache.set(gen_file_id, dependencies);
	} else {
		dependencies = dependencies_cache.get(gen_file_id);
	}

	if (!dependencies) return false;

	if (dependencies === 'all') return true;

	if (typeof dependencies !== 'function') {
		if (dependencies.patterns) {
			if (dependencies.patterns.some((p) => p.test(changed_file_id))) {
				return true;
			}
		}

		if (dependencies.files) {
			if (dependencies.files.includes(changed_file_id)) {
				return true;
			}
		}
	}

	return false;
};

/**
 * Resolve dependencies for a gen file.
 * Uses cache-busting to get fresh imports, allowing dependency
 * declarations to update during watch mode without restart.
 */
const resolve_gen_dependencies = async (
	gen_file_id: string,
	config: Gro_Config,
	filer: Filer,
	log: Logger,
	timings: Timings,
	invoke_task: Invoke_Task,
): Promise<Gen_Dependencies | null> => {
	try {
		const url = pathToFileURL(gen_file_id);
		url.searchParams.set('t', Date.now().toString());
		const module = await import(url.href);
		if (!validate_gen_module(module)) {
			return null;
		}

		const gen_config = normalize_gen_config(module.gen);
		if (!gen_config.dependencies) {
			return null;
		}

		let dependencies = gen_config.dependencies;
		if (typeof dependencies === 'function') {
			const gen_ctx: Gen_Context = {
				config,
				svelte_config: default_svelte_config,
				filer,
				log,
				timings,
				invoke_task,
				origin_id: gen_file_id,
				origin_path: to_root_path(gen_file_id),
			};
			dependencies = await dependencies(gen_ctx);
		}

		// Normalize file paths to absolute paths
		if (dependencies !== 'all' && dependencies.files) {
			dependencies.files = dependencies.files.map((f) => resolve(f));
		}

		return dependencies;
	} catch (err) {
		log.error(`Failed to resolve dependencies for ${gen_file_id}:`, err);
		return null;
	}
};
