import {printSpawnResult, spawn} from '@grogarden/util/process.js';

import type {Adapter} from './adapt.js';
import {TaskError} from './task.js';
import {load_package_json} from './package_json.js';
import {print_command_args, serialize_args, to_forwarded_args} from './args.js';
import {find_cli, spawn_cli} from './cli.js';

export const create_adapter = (): Adapter => {
	return {
		name: 'gro_adapter_library',
		adapt: async ({log, timings}) => {
			if (!(await find_cli('svelte-package'))) {
				log.warn(
					'failed to find svelte-package: ' +
						'install @sveltejs/package locally or globally to publish this repo,' +
						' or remove gro_adapter_library to suppress this warning',
				);
				return;
			}
			const serialized_args = serialize_args(to_forwarded_args('svelte-package'));
			log.info(print_command_args(serialized_args));
			await spawn_cli('svelte-package', serialized_args);

			const pkg = await load_package_json();

			// `npm link`
			if (pkg.bin) {
				const timing_to_npm_link = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (bin_path) => {
						const chmod_result = await spawn('chmod', ['+x', bin_path]);
						if (!chmod_result.ok)
							log.error(`chmod on bin path ${bin_path} failed with code ${chmod_result.code}`);
					}),
				);
				log.info(`linking`);
				const link_result = await spawn('npm', ['link', '-f']);
				if (!link_result.ok) {
					throw new TaskError(`Failed to link. ${printSpawnResult(link_result)}`);
				}
				timing_to_npm_link();
			}
		},
	};
};
