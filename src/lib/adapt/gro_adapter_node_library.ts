import {printSpawnResult, spawn} from '@feltjs/util/process.js';

import type {Adapter} from './adapt.js';
import {TaskError} from '../task/task.js';
import {load_package_json} from '../util/package_json.js';
import {print_command_args, serialize_args, to_forwarded_args} from '../task/args.js';
import {find_cli, spawn_cli} from '../util/cli.js';

export const createAdapter = (): Adapter => {
	return {
		name: 'gro_adapter_node_library',
		adapt: async ({fs, log, timings}) => {
			if (!(await find_cli(fs, 'svelte-package'))) {
				throw Error(`Failed to find svelte-package: install @sveltejs/package locally or globally`);
			}
			const serialized_args = serialize_args(to_forwarded_args('svelte-package'));
			log.info(print_command_args(serialized_args));
			await spawn_cli(fs, 'svelte-package', serialized_args);

			const pkg = await load_package_json(fs);

			// `npm link`
			if (pkg.bin) {
				const timing_to_npm_link = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (binPath) => {
						const chmod_result = await spawn('chmod', ['+x', binPath]);
						if (!chmod_result.ok) log.error(`CLI chmod failed with code ${chmod_result.code}`);
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
