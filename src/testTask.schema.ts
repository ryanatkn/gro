import {type ArgsSchema} from './task/task.js';

export const TestTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/TestTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: ['.+\\.test\\.js$'],
			description: 'file patterns to test',
		},
	},
	required: ['_'],
	additionalProperties: false,
};
