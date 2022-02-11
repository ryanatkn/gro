import {spawn} from '@feltcoop/felt/util/process.js';

import {type Task} from './task/task.js';
import {toRawRestArgs} from './utils/args.js';

export const task: Task = {
	summary: 'alias for `gro` with no task name provided',
	run: async (): Promise<void> => {
		await spawn('npx', ['gro', ...toRawRestArgs()]);
	},
};
