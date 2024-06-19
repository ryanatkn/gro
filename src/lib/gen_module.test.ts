import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {validate_gen_module, find_genfiles} from './gen_module.js';
import {paths} from './paths.js';

test('basic minimal interface', () => {
	assert.ok(validate_gen_module({gen: Function.prototype}));
});

test('basic invalid module', () => {
	assert.ok(!validate_gen_module({gen: {}}));
	assert.ok(!validate_gen_module({task: {run: {}}}));
	assert.ok(!validate_gen_module(undefined as any));
	assert.ok(!validate_gen_module(null as any));
	assert.ok(!validate_gen_module(false as any));
});

test('finds gen modules in a directory', async () => {
	const find_genfiles_result = await find_genfiles([join(paths.lib, 'docs/')]);
	assert.ok(find_genfiles_result.ok);
	assert.ok(find_genfiles_result.value.resolved_input_paths.length);
	assert.ok(find_genfiles_result.value.resolved_input_path_by_input_path.size);
});

test.run();
