import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {validate_gen_module, find_gen_modules} from './gen_module.js';
import {paths} from '../util/paths.js';

/* test__validate_gen_module */
const test__validate_gen_module = suite('validateBasicGenModule');

test__validate_gen_module('basic minimal interface', () => {
	assert.ok(validate_gen_module.basic({gen: Function.prototype}));
});

test__validate_gen_module('basic invalid module', () => {
	assert.ok(!validate_gen_module.basic({gen: {}}));
	assert.ok(!validate_gen_module.basic({task: {run: {}}}));
	assert.ok(!validate_gen_module.basic(undefined as any));
	assert.ok(!validate_gen_module.basic(null as any));
	assert.ok(!validate_gen_module.basic(false as any));
});

test__validate_gen_module('schema minimal interface', () => {
	assert.ok(validate_gen_module.schema({}));
	assert.ok(validate_gen_module.schema({SomeSchema: {$id: '/schemas/SomeSchema'}}));
});

test__validate_gen_module('schema invalid module', () => {
	assert.ok(!validate_gen_module.schema(undefined as any));
	assert.ok(!validate_gen_module.schema(null as any));
	assert.ok(!validate_gen_module.schema(false as any));
});

test__validate_gen_module.run();
/* test__validate_gen_module */

/* test__find_gen_modules */
const test__find_gen_modules = suite('find_gen_modules');

test__find_gen_modules('finds gen modules in a directory', async () => {
	const find_gen_modules_result = await find_gen_modules([join(paths.lib, 'docs/')]);
	assert.ok(find_gen_modules_result.ok);
	assert.ok(find_gen_modules_result.source_id_path_data_by_input_path.size);
});

test__find_gen_modules.run();
/* find_gen_modules_result */
