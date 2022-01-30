export const SomeTestObjectSchema = {
	$id: 'https://grocode.org/schemas/SomeTestObject.json',
	type: 'object',
	properties: {
		a: {type: 'number'},
		b: {type: 'string'},
		c: {
			type: 'object',
			tsType: 'A',
			tsImport: `import {type A} from './someTestTypes.js';`, // has a semicolon, single quotes
		},
		d: {
			type: 'object',
			tsType: 'A<B>',
			tsImport: [
				` import {type A} from "./someTestTypes.js" `, // no semicolon, double quotes, whitespace
				`import {type B} from "./someTestTypes.js"`,
			],
		},
	},
	required: ['a', 'b'],
	additionalProperties: false,
};

export const SomeTestPrimitiveSchema = {
	$id: 'https://grocode.org/schemas/SomeTestPrimitive.json',
	type: 'number',
};
