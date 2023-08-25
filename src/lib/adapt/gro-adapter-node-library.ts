import {printSpawnResult, spawn} from '@feltjs/util/process.js';
import {EMPTY_OBJECT} from '@feltjs/util/object.js';

import type {Adapter} from './adapt.js';
import {TaskError} from '../task/task.js';
import type {PackageJson} from '../util/packageJson.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from '../util/args.js';
import {findCli, spawnCli} from '../util/cli.js';

const name = '@feltjs/gro-adapter-node-library';

export interface Options {} // eslint-disable-line @typescript-eslint/no-empty-interface

export interface AdapterArgs {} // eslint-disable-line @typescript-eslint/no-empty-interface

export const createAdapter = (_opts: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	return {
		name,
		adapt: async ({fs, log, timings}) => {
			if (!(await findCli(fs, 'svelte-package'))) {
				throw Error(`Failed to find svelte-package: install @sveltejs/package locally or globally`);
			}
			const serializedArgs = serializeArgs(toForwardedArgs('svelte-package'));
			log.info(printCommandArgs(serializedArgs));
			await spawnCli(fs, 'svelte-package', serializedArgs);

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
