import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {validateGenModule, findGenModules} from './genModule.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* test__validateGenModule */
const test__validateGenModule = suite('validateBasicGenModule');

test__validateGenModule('basic minimal interface', () => {
	assert.ok(validateGenModule.basic({gen: Function.prototype}));
});

test__validateGenModule('basic invalid module', () => {
	assert.ok(!validateGenModule.basic({gen: {}}));
	assert.ok(!validateGenModule.basic({task: {run: {}}}));
	assert.ok(!validateGenModule.basic(undefined as any));
	assert.ok(!validateGenModule.basic(null as any));
	assert.ok(!validateGenModule.basic(false as any));
});

test__validateGenModule('schema minimal interface', () => {
	assert.ok(validateGenModule.schema({}));
	assert.ok(validateGenModule.schema({SomeSchema: {$id: '/schemas/SomeSchema'}}));
});

test__validateGenModule('schema invalid module', () => {
	assert.ok(!validateGenModule.schema(undefined as any));
	assert.ok(!validateGenModule.schema(null as any));
	assert.ok(!validateGenModule.schema(false as any));
});

test__validateGenModule.run();
/* test__validateGenModule */

/* test__findGenModules */
const test__findGenModules = suite('findGenModules');

test__findGenModules('finds gen modules in a directory', async () => {
	const findGenModulesResult = await findGenModules(fs, [join(paths.source, 'docs/')]);
	assert.ok(findGenModulesResult.ok);
	assert.ok(findGenModulesResult.sourceIdPathDataByInputPath.size);
});

test__findGenModules.run();
/* findGenModulesResult */
