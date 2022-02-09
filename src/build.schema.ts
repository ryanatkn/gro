import type {ArgsSchema} from './task/task.js';

export const BuildTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/BuildTaskArgs.json',
	type: 'object',
	properties: {
		clean: {type: 'boolean', default: true, description: ''},
		'no-clean': {
			type: 'boolean',
			default: false,
			description: 'opt out of cleaning before building; warning! this may break your build!',
		},
	},
	additionalProperties: false,
};
