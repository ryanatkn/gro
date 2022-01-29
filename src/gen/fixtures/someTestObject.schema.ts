export const SomeTestObjectSchema = {
	$id: 'https://grocode.org/schemas/SomeTestObject.json',
	type: 'object',
	properties: {
		a: {type: 'number'},
		b: {type: 'string'},
		c: {type: 'object', tsType: 'Gen', tsImport: `import {type Gen} from '../gen.js'`},
	},
	required: ['a', 'b'],
	additionalProperties: false,
};

export const SomeTestPrimitiveSchema = {
	$id: 'https://grocode.org/schemas/SomeTestPrimitive.json',
	type: 'number',
};
