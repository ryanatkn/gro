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
			tsType:
				'A<B<C<D<typeof E, B2,C2, C3, typeof F, typeof E3, typeof E4, typeof E2222222222222222>>>>',
			tsImport: [
				` import {type A} from "./someTestTypes.js" `, // no semicolon, double quotes, whitespace
				`import {type B, type C} from "./someTestTypes.js"`,
				`import type {B as B2, C as C2} from "./someTestTypes.js"`,
				` import/*comment*/E ,  {type D,type C as C3, E as E2222222222222222,  type  F} from "./someTestTypes.js"`,
				`import E3 from "./someTestTypes.js"`,
				`import type E4 from "./someTestTypes.js"`,
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
