import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'path';

import {validateGenModule, findGenModules} from './genModule.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* test__validateGenModule */
const test__validateGenModule = suite('validateGenModule');

test__validateGenModule('minimal interface', () => {
	assert.ok(validateGenModule({gen: () => {}}));
});

test__validateGenModule('invalid module', () => {
	assert.not.ok(validateGenModule({gen: {}}));
	assert.not.ok(validateGenModule({task: {run: {}}}));
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
/* /findGenModulesResult */
