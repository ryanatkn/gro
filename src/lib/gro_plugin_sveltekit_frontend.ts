import {spawn, spawn_process, type Spawned_Process} from '@grogarden/util/process.js';
import {cp, mkdir, writeFile} from 'node:fs/promises';
import {dirname, join, relative} from 'node:path';
import type {Config as SveltekitConfig} from '@sveltejs/kit';

import type {Plugin, PluginContext} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import {load_package_json, serialize_package_json, type MapPackageJson} from './package_json.js';
import {init_sveltekit_config} from './sveltekit_config.js';

export interface Options {
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: HostTarget;

	/**
	 * If truthy, adds `/.well-known/package.json` to the static output.
	 * If a function, maps the value.
	 */
	well_known_package_json?: boolean | MapPackageJson;

	/**
	 * Optional SvelteKit config, defaults to `svelte.config.js`.
	 */
	sveltekit_config?: string | SveltekitConfig;
}

export type HostTarget = 'github_pages' | 'static' | 'node';

export const plugin = ({
	host_target = 'github_pages',
	well_known_package_json,
	sveltekit_config,
}: Options = {}): Plugin<PluginContext> => {
	let sveltekit_process: Spawned_Process | null = null;
	return {
		name: 'gro_plugin_sveltekit_frontend',
		setup: async ({dev, watch, log}) => {
			const {assets_path} = await init_sveltekit_config(sveltekit_config);

			if (dev) {
				// `vite dev` in development mode
				if (watch) {
					const serialized_args = ['vite', 'dev', ...serialize_args(to_forwarded_args('vite'))];
					log.info(print_command_args(serialized_args));
					sveltekit_process = spawn_process('npx', serialized_args);
				} else {
					log.debug(
						`the SvelteKit frontend plugin is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				// `vite build` in production mode

				// copy files to `static` before building, in such a way
				// that's non-destructive to existing files and dirs and easy to clean up
				// TODO this doesn't work during dev -- maybe a Vite middleware is needed? what if this plugin added its plugin to your `vite.config.ts`?
				const cleanup = [
					well_known_package_json
						? copy_temporarily('package.json', assets_path, '.well-known')
						: null,
					/**
					 * GitHub pages processes everything with Jekyll by default,
					 * breaking things like files and dirs prefixed with an underscore.
					 * This adds a `.nojekyll` file to the root of the output
					 * to tell GitHub Pages to treat the outputs as plain static files.
					 */
					host_target === 'github_pages' ? copy_temporarily('.nojekyll', assets_path) : null,
				].filter(Boolean);
				process.exit();

				const serialized_args = ['vite', 'build', ...serialize_args(to_forwarded_args('vite'))];
				log.info(print_command_args(serialized_args));
				await spawn('npx', serialized_args);

				await Promise.all(cleanup.map((c) => c()));
			}
		},
		teardown: async () => {
			if (sveltekit_process) {
				sveltekit_process.child.kill();
				await sveltekit_process.closed;
			}
		},
	};
};

/**
 * Outputs `${dir}/.well-known/package.json` if it doesn't already exist.
 * @param well_known_package_json - if `undefined`, inferred to be `true` if `pkg.private` is falsy
 * @param output_dir
 */
const ensure_well_known_package_json = async (
	well_known_package_json: boolean | MapPackageJson | undefined,
	output_dir: string,
): Promise<void> => {
	const pkg = await load_package_json();
	if (well_known_package_json === undefined) {
		// TODO using `pkg.private` isn't semantic, maybe this should be removed
		// and we just document the danger for closed-source projects?
		well_known_package_json = !pkg.private; // eslint-disable-line no-param-reassign
	}
	if (!well_known_package_json) return;

	const mapped = well_known_package_json === true ? pkg : await well_known_package_json(pkg);
	if (!mapped) return;

	const svelte_config = await init_sveltekit_config(); // TODO param
	const well_known_dir = join(output_dir, svelte_config.assets_path, '..', '.well-known');
	const path = join(well_known_dir, 'package.json');
	if (await exists(path)) return; // don't clobber
	if (!(await exists(well_known_dir))) {
		await mkdir(well_known_dir, {recursive: true});
	}
	const new_contents = serialize_package_json(mapped);
	await writeFile(path, new_contents, 'utf8');
};

interface Cleanup_After_Copy {
	(): Promise<void>;
}

/**
 * Outputs `${dir}/.well-known/package.json` if it doesn't already exist.
 * @param well_known_package_json - if `undefined`, inferred to be `true` if `pkg.private` is falsy
 * @param output_dir
 */
const copy_temporarily = async (
	source_path: string,
	dest_dir: string,
	source_base_dir = dirname(source_path),
): Promise<Cleanup_After_Copy[]> => {
	console.log(`source_path`, source_path);
	console.log(`dest_dir`, dest_dir);
	console.log(`source_base_dir`, source_base_dir);
	const cleanup: Cleanup_After_Copy[] = [];

	const source_base_path = relative(source_base_dir, source_path);
	console.log(`source_base_path`, source_base_path);
	const output_path = join(dest_dir, source_path);
	console.log(`output_path`, output_path);

	if (await exists(path)) return; // don't clobber
	if (!(await exists(well_known_dir))) {
		await mkdir(well_known_dir, {recursive: true});
	}

	await cp(source_path, dest_dir);

	return cleanup;
};
