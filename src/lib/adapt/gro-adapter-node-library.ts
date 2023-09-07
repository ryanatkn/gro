import {printSpawnResult, spawn} from '@feltjs/util/process.js';

import type {Adapter} from './adapt.js';
import {TaskError} from '../task/task.js';
import type {PackageJson} from '../util/package_json.js';
import {print_command_args, serialize_args, to_forwarded_args} from '../task/args.js';
import {find_cli, spawn_cli} from '../util/cli.js';

const name = '@feltjs/gro-adapter-node-library';

export const createAdapter = (): Adapter => {
	return {
		name,
		adapt: async ({fs, log, timings}) => {
			if (!(await find_cli(fs, 'svelte-package'))) {
				throw Error(`Failed to find svelte-package: install @sveltejs/package locally or globally`);
			}
			const serialized_args = serialize_args(to_forwarded_args('svelte-package'));
			log.info(print_command_args(serialized_args));
			await spawn_cli(fs, 'svelte-package', serialized_args);

			let pkg: PackageJson;
			try {
				pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
			} catch (err) {
				throw Error(`Adapter ${name} failed to load package.json: ${err}`);
			}

			// `npm link`
			if (pkg.bin) {
				const timingToNpmLink = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (binPath) => {
						const chmodResult = await spawn('chmod', ['+x', binPath]);
						if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
					}),
				);
				log.info(`linking`);
				const linkResult = await spawn('npm', ['link', '-f']);
				if (!linkResult.ok) {
					throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
				}
				timingToNpmLink();
			}
		},
	};
};
