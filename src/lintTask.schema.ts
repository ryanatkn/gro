import {type ArgsSchema} from './task/task.js';
import {SOURCE_DIRNAME} from './paths.js';

export const LintTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/LintTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: [SOURCE_DIRNAME],
			description: 'paths to serve',
		},
	},
	// TODO
	// patternProperties: {

	// }
	required: ['_'],
	// TODO would be cool if we could add eslint CLI options here
	// additionalProperties: false,
};
