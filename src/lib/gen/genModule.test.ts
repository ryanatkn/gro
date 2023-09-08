import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {validateGenModule, find_gen_modules} from './genModule.js';
import {paths} from '../path/paths.js';
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

/* test__find_gen_modules */
const test__find_gen_modules = suite('find_gen_modules');

test__find_gen_modules('finds gen modules in a directory', async () => {
	const find_gen_modulesResult = await find_gen_modules(fs, [join(paths.lib, 'docs/')]);
	assert.ok(find_gen_modulesResult.ok);
	assert.ok(find_gen_modulesResult.source_id_path_data_by_input_path.size);
});

test__find_gen_modules.run();
/* find_gen_modulesResult */
