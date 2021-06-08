import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {validateGenModule, findGenModules} from './genModule.js';
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

/* test_findGenModules */
const test_findGenModules = suite('findGenModules');

test_findGenModules('finds gen modules in a directory', async () => {
	const findGenModulesResult = await findGenModules(fs, [join(paths.source, 'docs/')]);
	t.ok(findGenModulesResult.ok);
	t.ok(findGenModulesResult.source_idPathDataByInputPath.size);
});

test_findGenModules.run();
/* /findGenModulesResult */
