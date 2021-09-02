import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {validateGenModule, findGenModules} from './genModule.js';
import {paths} from '../paths.js';
import {fs} from '../fs/node.js';

/* testValidateGenModule */
const testValidateGenModule = suite('validateGenModule');

testValidateGenModule('minimal interface', () => {
	t.ok(validateGenModule({gen: () => {}}));
});

testValidateGenModule('invalid module', () => {
	t.not.ok(validateGenModule({gen: {}}));
	t.not.ok(validateGenModule({task: {run: {}}}));
});

testValidateGenModule.run();
/* /testValidateGenModule */

/* testFindGenModules */
const testFindGenModules = suite('findGenModules');

testFindGenModules('finds gen modules in a directory', async () => {
	const findGenModulesResult = await findGenModules(fs, [join(paths.source, 'docs/')]);
	t.ok(findGenModulesResult.ok);
	t.ok(findGenModulesResult.sourceIdPathDataByInputPath.size);
});

testFindGenModules.run();
/* /findGenModulesResult */
