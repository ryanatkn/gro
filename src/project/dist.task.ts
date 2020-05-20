import {Task, TaskError} from '../task/task.js';
import {printKeyValue} from '../utils/print.js';
import {spawnProcess} from '../utils/process.js';
import {task as distTask} from '../dist.task.js';

export const task: Task = {
	description: 'create and link the distribution',
	run: async (ctx) => {
		const {log} = ctx;

		await distTask.run(ctx);

		log.info('linking');
		const linkResult = await spawnProcess('npm', ['link']);
		if (!linkResult.ok) {
			throw new TaskError(`Failed to link. ${printKeyValue('code', linkResult.code)}`);
		}
	},
};
