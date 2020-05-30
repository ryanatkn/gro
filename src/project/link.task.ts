import {Task, TaskError} from '../task/task.js';
import {printKeyValue} from '../utils/print.js';
import {spawnProcess} from '../utils/process.js';

export const task: Task = {
	description: 'link the distribution',
	run: async () => {
		const linkResult = await spawnProcess('npm', ['link']);
		if (!linkResult.ok) {
			throw new TaskError(`Failed to link. ${printKeyValue('code', linkResult.code)}`);
		}
	},
};
