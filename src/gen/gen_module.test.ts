import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {validateGenModule, find_gen_modules} from './gen_module.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* test_validateGenModule */
const test_validateGenModule = suite('validateGenModule');

test_validateGenModule('minimal interface', () => {
	t.ok(validateGenModule({gen: () => {}}));
});

test_validateGenModule('invalid module', () => {
	t.not.ok(validateGenModule({gen: {}}));
	t.not.ok(validateGenModule({task: {run: {}}}));
});

test_validateGenModule.run();
/* /test_validateGenModule */

/* test_find_gen_modules */
const test_find_gen_modules = suite('find_gen_modules');

test_find_gen_modules('finds gen modules in a directory', async () => {
	const find_gen_modules_result = await find_gen_modules(fs, [join(paths.source, 'docs/')]);
	t.ok(find_gen_modules_result.ok);
	t.ok(find_gen_modules_result.source_id_path_data_by_input_path.size);
});

test_find_gen_modules.run();
/* /find_gen_modules_result */
