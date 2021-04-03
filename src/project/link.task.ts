import {Task, TaskError} from '../task/task.js';
import {printSpawnResult, spawnProcess} from '../utils/process.js';

export const task: Task = {
	description: 'link the distribution',
	run: async ({log}) => {
		log.info(`linking`);
		const linkResult = await spawnProcess('npm', ['link']);
		if (!linkResult.ok) {
			throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
		}
	},
};
