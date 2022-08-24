import type {ArgsSchema} from './utils/args.js';

export const UpgradeTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/UpgradeTaskArgs.json',
	type: 'object',
	properties: {
		_: {
			type: 'array',
			items: {type: 'string'},
			default: [],
			description: 'names of deps to exclude from the upgrade',
		},
		dry: {type: 'boolean', default: false, description: 'if true, print out the planned upgrades'},
	},
	required: ['_'],
	additionalProperties: false,
};
