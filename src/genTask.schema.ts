import {type ArgsSchema} from './task/task.js';

export const GenTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/GenTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: [],
			description: 'paths to generate',
		},
		check: {
			type: 'boolean',
			default: false,
			description: 'exit with a nonzero code if any files need to be generated',
		},
	},
	required: ['_', 'check'],
	additionalProperties: false,
};
