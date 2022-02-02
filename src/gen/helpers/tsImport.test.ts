import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {normalizeTsImports} from './tsImport.js';
import {fs} from '../../fs/node.js';

/* test__normalizeTsImports */
const test__normalizeTsImports = suite('normalizeTsImports');

test__normalizeTsImports('throws with multiple imports on the same line', async () => {
	try {
		await normalizeTsImports(
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

test__normalizeTsImports('throws with both default and named type imports', async () => {
	// This is disallowed by TypeScript:
	// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html
	try {
		await normalizeTsImports(
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

test__normalizeTsImports('throws with malformed type imports', async () => {
	try {
		await normalizeTsImports(fs, ['import type "./someTestExports.js"'], 'virtualTestFile.ts');
		assert.unreachable('should fail');
	} catch (err) {
		if (err.message === 'should fail') {
			throw err;
		}
	}
});

test__normalizeTsImports('throws with malformed type imports', async () => {
	try {
		await normalizeTsImports(
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

test__normalizeTsImports.run();
/* test__normalizeTsImports */
