import type {JsonSchema} from '../schema.js';

export const SomeTestObjectSchema: JsonSchema = {
	$id: '/schemas/SomeTestObject',
	type: 'object',
	properties: {
		a: {type: 'number'},
		b: {type: 'string'},
		c: {
			type: 'object',
			tsType: 'A',
			tsImport: `import type {A} from './some_test_exports.js';`,
		},
		d: {
			type: 'object',
			tsType:
				'A<B<C<D<typeof E, B2,C2, C3, typeof F, typeof E22222222222222222, typeof E3a & typeof E3b, typeof E4>>>>',
			tsImport: [
				` import type {A} from "./some_test_exports.js" `,
				`import type {B, C} from "./some_test_exports.js"`,
				`import  type {B as B2, C, C as C2} from "./some_test_exports.js"  // hmm`,
				` import E ,  {type D,\ntype C as C3,\n E as E22222222222222222,\n  type  F\n} from "./some_test_exports.js"  // hmm`,
				`import {type E3a, type E3b} from "./some_test_exports2.js";`,
				`import type E4 from "./some_test_exports3.js"`,
				`import "./some_test_exports.js"; // this is long and preserved`, // should be removed
				`import "./someTestSideEffect.js"; // side effects`, // preserve side effects
				`const a = await import('./asdf.js');`, // ignore dynamic
				`import  ('asdf', { assert: { type: 'json' }});`, // ignore inline dynamic
				`import.meta.asdf;`, // ignore `import.meta`
			],
		},
	},
	required: ['a', 'b'],
	tsImport: [],
	additionalProperties: false,
};

export const SomeTestPrimitiveSchema: JsonSchema = {
	$id: '/schemas/SomeTestPrimitive',
	type: 'number',
};
