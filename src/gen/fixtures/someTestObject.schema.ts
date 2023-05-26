import type {VocabSchema} from '../../utils/schema.js';

export const SomeTestObjectSchema: VocabSchema = {
	$id: 'SomeTestObject',
	type: 'object',
	properties: {
		a: {type: 'number'},
		b: {type: 'string'},
		c: {
			type: 'object',
			tsType: 'A',
			tsImport: `import type {A} from './someTestExports.js';`,
		},
		d: {
			type: 'object',
			tsType:
				'A<B<C<D<typeof E, B2,C2, C3, typeof F, typeof E22222222222222222, typeof E3a & typeof E3b, typeof E4>>>>',
			tsImport: [
				` import type {A} from "./someTestExports.js" `,
				`import type {B, C} from "./someTestExports.js"`,
				`import  type {B as B2, C, C as C2} from "./someTestExports.js"  // hmm`,
				` import E ,  {type D,\ntype C as C3,\n E as E22222222222222222,\n  type  F\n} from "./someTestExports.js"  // hmm`,
				`import {type E3a, type E3b} from "./someTestExports2.js";`,
				`import type E4 from "./someTestExports3.js"`,
				`import "./someTestExports.js"; // this is long and preserved`, // should be removed
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

export const SomeTestPrimitiveSchema = {
	$id: 'SomeTestPrimitive',
	type: 'number',
};
