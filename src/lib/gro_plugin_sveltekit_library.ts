import {print_spawn_result, spawn} from '@ryanatkn/belt/process.js';

import type {Plugin} from './plugin.ts';
import {Task_Error} from './task.ts';
import {load_package_json} from './package_json.ts';
import {
	SVELTE_PACKAGE_CLI,
	run_svelte_package,
	type Svelte_Package_Options,
} from './sveltekit_helpers.ts';

export interface Gro_Plugin_Sveltekit_Library_Options {
	/**
	 * The options passed to the SvelteKit packaging CLI.
	 * @see https://kit.svelte.dev/docs/packaging#options
	 */
	svelte_package_options?: Svelte_Package_Options;
	/**
	 * The SvelteKit packaging CLI to use. Defaults to `svelte-package`.
	 * @see https://kit.svelte.dev/docs/packaging
	 */
	svelte_package_cli?: string;
}

export const gro_plugin_sveltekit_library = ({
	svelte_package_options,
	svelte_package_cli = SVELTE_PACKAGE_CLI,
}: Gro_Plugin_Sveltekit_Library_Options = {}): Plugin => {
	const package_json = load_package_json();

	return {
		name: 'gro_plugin_sveltekit_library',
		setup: async ({dev, log, config}) => {
			if (!dev) {
				await run_svelte_package(
					package_json,
					svelte_package_options,
					svelte_package_cli,
					log,
					config.pm_cli,
				);
			}
		},
		adapt: async ({log, timings, config}) => {
			// link the CLI binaries if they exist
			if (package_json.bin) {
				const timing_to_link = timings.start(`${config.pm_cli} link`);
				await Promise.all(
					Object.values(package_json.bin).map(async (bin_path) => {
						const chmod_result = await spawn('chmod', ['+x', bin_path]);
						if (!chmod_result.ok)
							log.error(`chmod on bin path ${bin_path} failed with code ${chmod_result.code}`);
					}),
				);
				log.info(`linking`);
				const link_result = await spawn(config.pm_cli, ['link', '-f']); // TODO don't use `-f` unless necessary or at all?
				if (!link_result.ok) {
					throw new Task_Error(`Failed to link. ${print_spawn_result(link_result)}`);
				}
				timing_to_link();
			}
		},
	};
};
