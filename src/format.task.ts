import {Task, TaskError} from './task/task.js';
import {spawnProcess} from './utils/process.js';
import {printKeyValue} from './utils/print.js';
import {paths} from './paths.js';

const FORMATTED_EXTENSIONS = 'ts,js,json,svelte,html,css,md,yml';

export const task: Task = {
	description: 'format source files',
	run: async ({args}) => {
		const check = !!args.check; // TODO args declaration and validation

		const formatResult = await spawnProcess('node_modules/.bin/prettier', [
			check ? '--check' : '--write',
			`${paths.source}**/*.{${FORMATTED_EXTENSIONS}}`,
			`${paths.root}*.{${FORMATTED_EXTENSIONS}}`,
		]);

		if (!formatResult.ok) {
			throw new TaskError(
				`Failed ${check ? 'formatting check' : 'to format'}. ${printKeyValue(
					'code',
					formatResult.code,
				)}`,
			);
		}
	},
};
