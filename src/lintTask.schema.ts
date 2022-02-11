import {type ArgsSchema} from './task/task.js';
import {SOURCE_DIRNAME} from './paths.js';

export const LintTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/LintTaskArgs.json',
	type: 'object',
	// TODO how to specify that this takes an `eslint` command and args after the `--`?
	// At least for the help text?
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: [SOURCE_DIRNAME],
			description: 'paths to serve',
		},
	},
	required: ['_'],
	additionalProperties: false,
};
