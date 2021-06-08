import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {validate_gen_module, find_gen_modules} from './gen_module.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* test_validate_gen_module */
const test_validate_gen_module = suite('validate_gen_module');

test_validate_gen_module('minimal interface', () => {
	t.ok(validate_gen_module({gen: () => {}}));
});

test_validate_gen_module('invalid module', () => {
	t.not.ok(validate_gen_module({gen: {}}));
	t.not.ok(validate_gen_module({task: {run: {}}}));
});

test_validate_gen_module.run();
/* /test_validate_gen_module */

/* test_find_gen_modules */
const test_find_gen_modules = suite('find_gen_modules');

test_find_gen_modules('finds gen modules in a directory', async () => {
	const find_gen_modules_result = await find_gen_modules(fs, [join(paths.source, 'docs/')]);
	t.ok(find_gen_modules_result.ok);
	t.ok(find_gen_modules_result.source_id_path_data_by_input_path.size);
});

test_find_gen_modules.run();
/* /find_gen_modules_result */
