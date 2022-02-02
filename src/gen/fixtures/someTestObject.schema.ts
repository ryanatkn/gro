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
			tsType: 'A<B<C<D<typeof E, C2, typeof F, typeof E2, typeof F2>>>>',
			tsImport: [
				` import {type A} from "./someTestTypes.js" `, // no semicolon, double quotes, whitespace
				`import {type B, type C} from "./someTestTypes.js"`,
				` import  E ,  {type D,type C as C2,  type  F} from "./someTestTypes.js"`,
				`import E2 from "./someTestTypes.js"`,
				`import type {F as F2} from "./someTestTypes.js"`,
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
