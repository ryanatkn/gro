import {Task} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {printKeyValue} from './utils/print.js';

export const task: Task = {
	description: 'typecheck the project without emitting any files',
	run: async () => {
		const typecheckResult = await spawnProcess('node_modules/.bin/tsc', [
			'--noEmit',
		]);
		if (!typecheckResult.ok) {
			throw Error(
				`Typechecking failed ${printKeyValue('code', typecheckResult.code)}`,
			);
		}
	},
};
