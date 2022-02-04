export const CheckTaskArgsSchema = {
	$id: '/schemas/CheckTaskArgs.json',
	type: 'object',
	properties: {
		_: {type: 'array', items: {type: 'string'}},
		typecheck: {type: 'boolean'},
		'no-typecheck': {type: 'boolean'},
		test: {type: 'boolean'},
		'no-test': {type: 'boolean'},
		gen: {type: 'boolean'},
		'no-gen': {type: 'boolean'},
		format: {type: 'boolean'},
		'no-format': {type: 'boolean'},
		lint: {type: 'boolean'},
		'no-lint': {type: 'boolean'},
	},
	required: ['_'],
	additionalProperties: false,
};
