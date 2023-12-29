import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {validate_gen_module, find_gen_modules, to_gen_schema_name} from './gen_module.js';
import {paths} from './paths.js';

test('basic minimal interface', () => {
	assert.ok(validate_gen_module.basic({gen: Function.prototype}));
});

test('basic invalid module', () => {
	assert.ok(!validate_gen_module.basic({gen: {}}));
	assert.ok(!validate_gen_module.basic({task: {run: {}}}));
	assert.ok(!validate_gen_module.basic(undefined as any));
	assert.ok(!validate_gen_module.basic(null as any));
	assert.ok(!validate_gen_module.basic(false as any));
});

test('schema minimal interface', () => {
	assert.ok(validate_gen_module.schema({}));
	assert.ok(validate_gen_module.schema({SomeSchema: {$id: '/schemas/SomeSchema'}}));
});

test('schema invalid module', () => {
	assert.ok(!validate_gen_module.schema(undefined as any));
	assert.ok(!validate_gen_module.schema(null as any));
	assert.ok(!validate_gen_module.schema(false as any));
});

test('finds gen modules in a directory', async () => {
	const find_gen_modules_result = await find_gen_modules([join(paths.lib, 'docs/')]);
	assert.ok(find_gen_modules_result.ok);
	assert.ok(find_gen_modules_result.source_id_path_data_by_input_path.size);
});

test('to_gen_schema_name', () => {
	assert.is(to_gen_schema_name('ASchema'), 'A');
	assert.is(to_gen_schema_name('A_Schema'), 'A');
	assert.is(to_gen_schema_name('A_'), 'A_');
	assert.is(to_gen_schema_name('A_SchemaSchema'), 'A_Schema');
	assert.is(to_gen_schema_name('A_Schema_Schema'), 'A_Schema');
	assert.is(to_gen_schema_name('A__Schema'), 'A_');
});

test.run();
