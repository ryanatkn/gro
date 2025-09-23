import {realpathSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn, type Spawn_Result} from '@ryanatkn/belt/process.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Timings} from '@ryanatkn/belt/timings.js';

import {JS_CLI_DEFAULT, NODE_MODULES_DIRNAME, SVELTEKIT_DIST_DIRNAME} from './constants.ts';
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

/*

This module is intended to have minimal dependencies to avoid over-imports in the CLI.

*/

/**
 * Resolves a path to an internal Gro file.
 * Prefers any local installation of Gro and falls back to the current CLI context.
 *
 * Uses heuristics to find `path`, so may fail in some rare corner cases.
 * Currently looks for `gro.js` as a sibling to the `path` arg for detection.
 * If this fails for your usecases, rename `gro.js` or open an issue/PR!
 *
 * Used by the CLI and `gro run`.
 *
 * case 1:
 *
 * We're in a directory that has a local installation of Gro at `node_modules/.bin/gro`.
 * Use this local version instead of the global.
 *
 * case 2:
 *
 * We're running Gro inside the Gro repo itself.
 *
 * In this case, we use the build directory instead of dist.
 * There's a paradox here for using Gro inside itself -
 * ideally we use the dist directory because that's what's shipped,
 * but the build directory has all of the tests,
 * and loading two instances of its modules causes problems
 * like `instanceof` checks failing.
 * For now we'll just run from build and see if it causes any problems.
 * There's probably a better design in here somewhere.
 *
 * case 3:
 *
 * Fall back to invoking Gro from wherever the CLI is being executed.
 * When using the global CLI, this uses the global Gro installation.
 *
 */
export const resolve_gro_module_path = (path = ''): string => {
	const gro_bin_path = resolve(NODE_MODULES_DIRNAME, '.bin/gro');
	// case 1
	// Prefer any locally installed version of Gro.
	// This is really confusing if Gro is installed inside Gro itself,
	// so avoid that when developing Gro.
	if (existsSync(gro_bin_path)) {
		return join(realpathSync(gro_bin_path), '..', path);
	}
	// case 2
	// If running Gro inside its own repo, require the local dist.
	// If the local dist is not yet built it will fall back to the global.
	if (
		existsSync(join(SVELTEKIT_DIST_DIRNAME, 'gro.js')) &&
		existsSync(join(SVELTEKIT_DIST_DIRNAME, path))
	) {
		return resolve(SVELTEKIT_DIST_DIRNAME, path);
	}
	// case 3
	// Fall back to the version associated with the running CLI.
	const file_path = fileURLToPath(import.meta.url);
	return join(file_path, '..', path);
};

/**
 * Runs a file using the Gro loader.
 *
 * Uses conditional exports to correctly set up `esm-env` as development by default,
 * so if you want production set `NODE_ENV=production`.
 *
 * @see https://nodejs.org/api/packages.html#conditional-exports
 *
 * @param loader_path path to loader
 * @param invoke_path path to file to spawn with `node`
 */
export const spawn_with_loader = (
	loader_path: string,
	invoke_path: string,
	argv: Array<string>,
	js_cli = JS_CLI_DEFAULT, // TODO source from config when possible
): Promise<Spawn_Result> => {
	const args = [
		'--import',
		// This does the same as `$lib/register.ts` but without the cost of importing another file.
		`data:text/javascript,
			import {register} from "node:module";
			import {pathToFileURL} from "node:url";
			register("${loader_path}", pathToFileURL("./"));`,
		// @sync Node options to `$lib/gro.ts`
		'--experimental-import-meta-resolve', // for `import.meta.resolve`
		'--experimental-strip-types',
		'--disable-warning',
		'ExperimentalWarning',
	];
	// In almost all cases we want the exports condition to be `"development"`. Needed for `esm-env`.
	if (process.env.NODE_ENV !== 'production') {
		args.push('-C', 'development'); // same as `--conditions`
	}
	args.push(invoke_path, ...argv);
	return spawn(js_cli, args);
};

/**
 * Check if a file change should trigger a gen file.
 */
export const should_trigger_gen = async (
	gen_file_id: string,
	changed_file_id: string,
	config: Gro_Config,
	filer: Filer,
	log: Logger,
	timings: Timings,
	invoke_task: Invoke_Task,
): Promise<boolean> => {
	// Always trigger if the gen file itself changed
	if (gen_file_id === changed_file_id) return true;

	const deps = await resolve_gen_dependencies(
		gen_file_id,
		config,
		filer,
		log,
		timings,
		invoke_task,
	);

	if (!deps) return false;

	if (deps === 'all') return true;

	if (typeof deps !== 'function') {
		if (deps.patterns) {
			if (deps.patterns.some((p) => p.test(changed_file_id))) {
				return true;
			}
		}

		if (deps.files) {
			if (deps.files.includes(changed_file_id)) {
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
): Promise<Gen_Dependencies | undefined> => {
	try {
		const url = pathToFileURL(gen_file_id);
		url.searchParams.set('t', Date.now().toString());
		const module = await import(url.href);
		if (!validate_gen_module(module)) {
			return undefined;
		}

		const gen_config = normalize_gen_config(module.gen);
		if (!gen_config.dependencies) {
			return undefined;
		}

		let deps = gen_config.dependencies;
		if (typeof deps === 'function') {
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
			deps = await deps(gen_ctx);
		}

		return deps;
	} catch (err) {
		log.error(`Failed to resolve dependencies for ${gen_file_id}:`, err);
		return undefined;
	}
};
