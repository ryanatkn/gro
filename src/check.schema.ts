import type {ArgsSchema} from './task/task.js';

// TODO what if `.task.` files were used by `gro gen` automatically
// so we could simply export the schema there instead of needing this file?

export const CheckTaskArgsSchema: ArgsSchema = {
	$id: '/schemas/CheckTaskArgs.json',
	type: 'object',
	properties: {
		typecheck: {type: 'boolean', default: true, description: ''},
		'no-typecheck': {type: 'boolean', default: false, description: 'opt out of typechecking'},
		test: {type: 'boolean', default: true, description: ''},
		'no-test': {type: 'boolean', default: false, description: 'opt out of running tests'},
		gen: {type: 'boolean', default: true, description: ''},
		'no-gen': {type: 'boolean', default: false, description: 'opt out of gen check'},
		format: {type: 'boolean', default: true, description: ''},
		'no-format': {type: 'boolean', default: false, description: 'opt out of format check'},
		lint: {type: 'boolean', default: true, description: ''},
		'no-lint': {type: 'boolean', default: false, description: 'opt out of linting'},
	},
	required: ['_'],
	additionalProperties: false,
};
