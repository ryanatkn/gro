import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {normalize_type_imports} from './type_imports.js';

/* test__normalize_type_imports */
const test__normalize_type_imports = suite('normalize_type_imports');

test__normalize_type_imports('throws with multiple imports on the same line', async () => {
	try {
		await normalize_type_imports(
			['import E3 from "./someTestExports.js"; import type E4 from "./someTestExports.js"'],
			'virtualTestFile.ts',
		);
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalize_type_imports('throws with both default and named type imports', async () => {
	// This is disallowed by TypeScript:
	// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html
	try {
		await normalize_type_imports(
			['import type E3, {E4} from "./someTestExports.js"'],
			'virtualTestFile.ts',
		);
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalize_type_imports('throws with malformed type imports', async () => {
	try {
		await normalize_type_imports(['import type "./someTestExports.js"'], 'virtualTestFile.ts');
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalize_type_imports('throws with malformed type imports', async () => {
	try {
		await normalize_type_imports(
			['import A from "./someTestExports.js"', 'import B from "./someTestExports.js"'],
			'virtualTestFile.ts',
		);
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalize_type_imports.run();
/* test__normalize_type_imports */
