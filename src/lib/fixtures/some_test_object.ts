// generated by src/lib/fixtures/some_test_object.schema.ts

import type E from './some_test_exports.js'; // this is long and preserved
import type {
	A,
	B,
	C,
	B as B2,
	C as C2,
	D,
	C as C3,
	E as E22222222222222222,
	F,
} from './some_test_exports.js'; // this is long and preserved
import type {E3a, E3b} from './some_test_exports2.js';
import type E4 from './some_test_exports3.js';
import './some_test_side_effect.js'; // side effects

export interface SomeTestObject {
	a: number;
	b: string;
	c?: A;
	d?: A<
		B<
			C<
				D<
					typeof E,
					B2,
					C2,
					C3,
					typeof F,
					typeof E22222222222222222,
					typeof E3a & typeof E3b,
					typeof E4
				>
			>
		>
	>;
}
export type SomeTestPrimitive = number;

// generated by src/lib/fixtures/some_test_object.schema.ts
