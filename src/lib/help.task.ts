import {spawn} from '@feltjs/util/process.js';

import type {Task} from './task/task.js';
import {toRawRestArgs} from './util/args.js';

export const task: Task = {
	summary: 'alias for `gro` with no task name provided',
	run: async (): Promise<void> => {
		await spawn('npx', ['gro', ...toRawRestArgs()]);
	},
};
