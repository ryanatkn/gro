import {print_spawn_result, spawn} from '@grogarden/util/process.js';

import type {Plugin, PluginContext} from './plugin.js';
import {TaskError} from './task.js';
import {load_package_json} from './package_json.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli} from './cli.js';

export const plugin = (): Plugin<PluginContext> => {
	return {
		name: 'gro_plugin_library',
		adapt: async ({log, timings}) => {
			if (!(await find_cli('svelte-package'))) {
				log.warn(
					'failed to find svelte-package: ' +
						'install @sveltejs/package locally or globally to publish this repo,' +
						' or remove gro_plugin_library to suppress this warning',
				);
				return;
			}
			const serialized_args = serialize_args(to_forwarded_args('svelte-package'));
			log.info(print_command_args(serialized_args));
			await spawn_cli('svelte-package', serialized_args);

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
					throw new TaskError(`Failed to link. ${print_spawn_result(link_result)}`);
				}
				timing_to_npm_link();
			}
		},
	};
};
