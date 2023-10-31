import {spawn_process, type SpawnedProcess} from '@grogarden/util/process.js';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Plugin, Plugin_Context} from './plugin.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';
import {
	serialize_package_json,
	type Map_Package_Json,
	load_mapped_package_json,
} from './package_json.js';
import {init_sveltekit_config} from './sveltekit_config.js';
import {Task_Error} from './task.js';
import {spawn_cli} from './cli.js';

export interface Options {
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: Host_Target;

	/**
	 * If truthy, adds `/.well-known/package.json` to the static output.
	 * If a function, maps the value.
	 */
	well_known_package_json?: boolean | Map_Package_Json;
}

export type Host_Target = 'github_pages' | 'static' | 'node';

const output_dir = SVELTEKIT_BUILD_DIRNAME;

export const plugin = ({
	host_target = 'github_pages',
	well_known_package_json,
}: Options = {}): Plugin<Plugin_Context> => {
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
				const serialized_args = ['build', ...serialize_args(to_forwarded_args('vite'))];
				log.info(print_command_args(['vite'].concat(serialized_args)));
				const spawned = await spawn_cli('vite', serialized_args); // TODO call with the gro helper instead of npx?
				if (!spawned?.ok) {
					throw new Task_Error('vite build failed with exit code ' + spawned?.code);
				}
			}
		},
		adapt: async () => {
			if (host_target === 'github_pages') {
				await ensure_nojekyll(output_dir);
			}

			// TODO doing this here makes `static/.well-known/package.json` unavailable to Vite plugins,
			// so we may want to do a more complicated temporary copy
			// into `static/` before `vite build` in `setup`,
			// and afterwards it would delete the files but only if they didn't already exist
			await ensure_well_known_package_json(well_known_package_json, output_dir);
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

/**
 * Outputs `${dir}/.well-known/package.json` if it doesn't already exist.
 * @param well_known_package_json - if `undefined`, inferred to be `true` if `pkg.public` is truthy
 * @param output_dir
 */
const ensure_well_known_package_json = async (
	well_known_package_json: boolean | Map_Package_Json | undefined,
	output_dir: string,
): Promise<void> => {
	const package_json = await load_mapped_package_json();

	if (well_known_package_json === undefined) {
		well_known_package_json = package_json.public; // eslint-disable-line no-param-reassign
	}
	if (!well_known_package_json) return;

	const mapped =
		well_known_package_json === true ? package_json : await well_known_package_json(package_json);
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
