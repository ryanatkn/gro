import type {Adapter} from './adapt.js';
import {Timings} from '../utils/time.js';
import {printTimings} from '../utils/print.js';
import {printSpawnResult, spawnProcess} from '../utils/process.js';
import {TaskError} from '../task/task.js';

export interface Options {
	path: string; // e.g. 'dist/cli/gro.js'
}

export const createAdapter = ({path}: Options): Adapter => {
	return {
		name: 'gro-adapter-npm-link',
		adapt: async ({log}) => {
			const timings = new Timings(); // TODO probably move to task context

			const timingToNpmLink = timings.start('npm link');
			const chmodResult = await spawnProcess('chmod', ['+x', path]);
			if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
			log.info(`linking`);
			const linkResult = await spawnProcess('npm', ['link']);
			if (!linkResult.ok) {
				throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
			}
			timingToNpmLink();

			printTimings(timings, log);
		},
	};
};
