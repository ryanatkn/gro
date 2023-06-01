import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {normalizeTypeImports} from './typeImports.js';
import {fs} from '../../fs/node.js';

/* test__normalizeTypeImports */
const test__normalizeTypeImports = suite('normalizeTypeImports');

test__normalizeTypeImports('throws with multiple imports on the same line', async () => {
	try {
		await normalizeTypeImports(
			fs,
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

test__normalizeTypeImports('throws with both default and named type imports', async () => {
	// This is disallowed by TypeScript:
	// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html
	try {
		await normalizeTypeImports(
			fs,
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

test__normalizeTypeImports('throws with malformed type imports', async () => {
	try {
		await normalizeTypeImports(fs, ['import type "./someTestExports.js"'], 'virtualTestFile.ts');
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalizeTypeImports('throws with malformed type imports', async () => {
	try {
		await normalizeTypeImports(
			fs,
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

test__normalizeTypeImports.run();
/* test__normalizeTypeImports */
