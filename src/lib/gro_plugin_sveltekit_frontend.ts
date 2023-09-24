import {spawn, spawnProcess, type SpawnedProcess} from '@grogarden/util/process.js';
import {strip_end} from '@grogarden/util/string.js';
import {mkdir, rm, writeFile} from 'node:fs/promises';

import type {Plugin, PluginContext} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import {load_package_json} from './package_json.js';
import {load_sveltekit_config} from './sveltekit_config.js';

export interface Options {
	dir?: string;
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: HostTarget;
	/**
	 * If `true`, or if `undefined` and the `package.json` property `"private"` is falsy,
	 * includes `package.json` in the static `.well-known` directory for production builds.
	 * Ignored during development, which isn't ideal and should be fixed,
	 * but being non-invasive is a priority.
	 * Projects shouldn't have to configure this or be exposed to its fs hackery to benefit.
	 * @default undefined
	 */
	well_known_package_json?: boolean | undefined;
}

export type HostTarget = 'github_pages' | 'static' | 'node';

export const plugin = ({
	dir = SVELTEKIT_BUILD_DIRNAME, // TODO what about cwd like other plugins? like for loading the SvelteKit config
	host_target = 'github_pages',
	well_known_package_json,
}: Options = {}): Plugin<PluginContext> => {
	const output_dir = strip_end(dir, '/');

	let sveltekit_process: SpawnedProcess | null = null;
	return {
		name: 'gro_plugin_sveltekit_frontend',
		setup: async ({dev, watch, config, log}) => {
			if (dev) {
				// development mode
				if (watch) {
					const serialized_args = ['vite', 'dev', ...serialize_args(to_forwarded_args('vite'))];
					log.info(print_command_args(serialized_args));
					sveltekit_process = spawnProcess('npx', serialized_args);
				} else {
					log.debug(
						`the SvelteKit frontend plugin is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				// build for production

				// fs hackery to add `/.well-known/package.json` - maybe switch to a Vite plugin
				const pkg = await load_package_json();
				// include the static `.well-known/package.json` as needed
				let including_package_json = false;
				if (well_known_package_json) {
					including_package_json = true;
				} else if (well_known_package_json === undefined) {
					including_package_json = !pkg.private;
				}
				let added_package_json_path: string | undefined;
				let added_well_known_dir: string | undefined;
				if (including_package_json) {
					const mapped = await config.package_json(pkg, 'well_known');
					if (mapped !== null) {
						// copy the `package.json` over to `static/.well-known/` if configured unless it exists
						const svelte_config = await load_sveltekit_config();
						const static_assets = svelte_config?.kit?.files?.assets || 'static';
						const well_known_dir = strip_end(static_assets, '/') + '/.well-known';
						if (!(await exists(well_known_dir))) {
							await mkdir(well_known_dir, {recursive: true});
							added_well_known_dir = well_known_dir;
						}
						const package_json_path = well_known_dir + '/package.json';
						if (!(await exists(package_json_path))) {
							await writeFile(package_json_path, JSON.stringify(mapped));
							added_package_json_path = package_json_path;
						}
					}
				}

				// vite build
				const serialized_args = ['vite', 'build', ...serialize_args(to_forwarded_args('vite'))];
				log.info(print_command_args(serialized_args));
				await spawn('npx', serialized_args);

				// cleanup fs hackery
				// we don't wait for `adapt` because we don't want these fs changes to leak -
				// revert the static directory back to its original state
				if (added_well_known_dir) {
					// remove the whole `.well-known` directory
					await rm(added_well_known_dir, {recursive: true});
				} else if (added_package_json_path) {
					// delete only the copied file
					await rm(added_package_json_path);
				}
			}
		},
		adapt: async () => {
			if (host_target === 'github_pages') {
				await Promise.all([ensure_nojekyll(output_dir)]);
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

const NOJEKYLL_FILENAME = '.nojekyll';

/**
 * GitHub pages processes everything with Jekyll by default,
 * breaking things like files and dirs prefixed with an underscore.
 * This adds a `.nojekyll` file to the root of the output
 * to tell GitHub Pages to treat the outputs as plain static files.
 */
const ensure_nojekyll = async (dir: string): Promise<void> => {
	const path = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!(await exists(path))) {
		await mkdir(dir, {recursive: true});
		await writeFile(path, '', 'utf8');
	}
};
