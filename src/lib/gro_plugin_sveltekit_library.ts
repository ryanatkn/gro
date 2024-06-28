import {print_spawn_result, spawn} from '@ryanatkn/belt/process.js';

import type {Plugin, Plugin_Context} from './plugin.js';
import {Task_Error} from './task.js';
import {load_package_json} from './package_json.js';
import {serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli} from './cli.js';
import {SVELTE_PACKAGE_CLI, has_sveltekit_library} from './sveltekit_helpers.js';

// TODO suport typesafe CLI args that can continue to be overridden by the CLI via forwarded args - https://kit.svelte.dev/docs/packaging
export interface Options {
	/**
	 * The SvelteKit packaging CLI to use. Defaults to `svelte-package`.
	 */
	svelte_package_cli?: string;
}

export const gro_plugin_sveltekit_library = ({
	svelte_package_cli = SVELTE_PACKAGE_CLI,
}: Options = {}): Plugin<Plugin_Context> => {
	return {
		name: 'gro_plugin_sveltekit_library',
		setup: async ({log}) => {
			const has_sveltekit_library_result = await has_sveltekit_library();
			if (!has_sveltekit_library_result.ok) {
				throw new Task_Error(
					'Failed to find SvelteKit library: ' + has_sveltekit_library_result.message,
				);
			}
			const found_svelte_package_cli = find_cli(svelte_package_cli);
			if (found_svelte_package_cli?.kind !== 'local') {
				throw new Task_Error(
					`Failed to find SvelteKit packaging CLI \`${svelte_package_cli}\`, do you need to run \`npm i\`?`,
				);
			}
			const serialized_args = serialize_args(to_forwarded_args(svelte_package_cli));
			await spawn_cli(found_svelte_package_cli, serialized_args, log);
		},
		adapt: async ({log, timings}) => {
			const package_json = await load_package_json();

			// `npm link`
			if (package_json.bin) {
				const timing_to_npm_link = timings.start('npm link');
				await Promise.all(
					Object.values(package_json.bin).map(async (bin_path) => {
						const chmod_result = await spawn('chmod', ['+x', bin_path]);
						if (!chmod_result.ok)
							log.error(`chmod on bin path ${bin_path} failed with code ${chmod_result.code}`);
					}),
				);
				log.info(`linking`);
				const link_result = await spawn('npm', ['link', '-f']); // TODO don't use `-f` unless necessary or at all?
				if (!link_result.ok) {
					throw new Task_Error(`Failed to link. ${print_spawn_result(link_result)}`);
				}
				timing_to_npm_link();
			}
		},
	};
};
