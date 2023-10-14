import {spawn, spawn_process, type SpawnedProcess} from '@grogarden/util/process.js';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Plugin, PluginContext} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import type {MapPackageJson} from './package_json.js';

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
}

export type HostTarget = 'github_pages' | 'static' | 'node';

const output_dir = SVELTEKIT_BUILD_DIRNAME;

export const plugin = ({
	host_target = 'github_pages',
	well_known_package_json = false,
}: Options = {}): Plugin<PluginContext> => {
	let sveltekit_process: SpawnedProcess | null = null;
	return {
		name: 'gro_plugin_sveltekit_frontend',
		setup: async ({dev, watch, log}) => {
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

				// first copy static files

				const serialized_args = ['vite', 'build', ...serialize_args(to_forwarded_args('vite'))];
				log.info(print_command_args(serialized_args));
				await spawn('npx', serialized_args);
			}
		},
		adapt: async () => {
			if (host_target === 'github_pages') {
				await Promise.all([ensure_nojekyll(output_dir)]);
			}

			// TODO BLOCK should this populate `static` before `vite build` or write during `adapt`?
			// TODO BLOCK maybe use a function returning a function with the cleanup (which ensures it gets called at most once)

			// add `/.well-known/package.json` as needed
			if (well_known_package_json) {
				const pkg = await load_package_json(); // TODO BLOCK maybe run sync/exports here? before every load?
				const mapped = well_known_package_json === true ? pkg : await well_known_package_json(pkg);
				// TODO refactor
				if (mapped) {
					// copy the `package.json` over to `static/.well-known/` if configured unless it exists
					const svelte_config = await load_sveltekit_config();
					const static_assets = svelte_config?.kit?.files?.assets || 'static';
					const well_known_dir = join(static_assets, '.well-known');
					if (!(await exists(well_known_dir))) {
						await mkdir(well_known_dir, {recursive: true});
					}
					const path = well_known_dir + '/package.json';
					const new_contents = serialize_package_json(mapped);
					let changed = false;
					if (await exists(path)) {
						const old_contents = await readFile(path, 'utf8');
						if (new_contents === old_contents) {
							changed = false;
						} else {
							changed = true;
						}
					} else {
						changed = true;
					}
					if (changed) {
						log.info(`updating package.json at`, path);
						await writeFile(path, new_contents);
					} else {
						log.info(`no changes to package.json at`, path);
					}
				}
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
