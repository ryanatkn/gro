import {type ArgsSchema} from './task/task.js';

export const DevTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/DevTaskArgs.json',
	type: 'object',
	properties: {
		watch: {type: 'boolean', default: true, description: ''},
		'no-watch': {
			type: 'boolean',
			default: false,
			description: 'opt out of running a long-lived process to watch files and rebuild on changes',
		},
		// TODO this flag is weird, it detects https credentials but should probably be explicit and fail if not available
		insecure: {type: 'boolean', default: undefined, description: 'ignore https credentials'},
		cert: {type: 'string', default: undefined, description: 'https certificate file'},
		certkey: {type: 'string', default: undefined, description: 'https certificate key file'},
	},
	additionalProperties: false,
};
