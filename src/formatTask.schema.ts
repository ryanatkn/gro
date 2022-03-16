import type {ArgsSchema} from './utils/args.js';

export const FormatTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/FormatTaskArgs.json',
	type: 'object',
	properties: {
		check: {
			type: 'boolean',
			default: false,
			description: 'exit with a nonzero code if any files are unformatted',
		},
	},
	required: ['check'],
	additionalProperties: false,
};
