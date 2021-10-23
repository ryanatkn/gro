import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'path';

import {validateGenModule, findGenModules} from './genModule.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* testValidateGenModule */
const testValidateGenModule = suite('validateGenModule');

testValidateGenModule('minimal interface', () => {
	assert.ok(validateGenModule({gen: () => {}}));
});

testValidateGenModule('invalid module', () => {
	assert.not.ok(validateGenModule({gen: {}}));
	assert.not.ok(validateGenModule({task: {run: {}}}));
});

testValidateGenModule.run();
/* /testValidateGenModule */

/* testFindGenModules */
const testFindGenModules = suite('findGenModules');

testFindGenModules('finds gen modules in a directory', async () => {
	const findGenModulesResult = await findGenModules(fs, [join(paths.source, 'docs/')]);
	assert.ok(findGenModulesResult.ok);
	assert.ok(findGenModulesResult.sourceIdPathDataByInputPath.size);
});

testFindGenModules.run();
/* /findGenModulesResult */
