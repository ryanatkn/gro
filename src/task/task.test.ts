import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {isTaskPath, toTaskName} from './task.js';

/* test__isTaskPath */
const test__isTaskPath = suite('isTaskPath');

test__isTaskPath('basic behavior', () => {
	assert.ok(isTaskPath('foo.task.ts'));
	assert.not.ok(isTaskPath('foo.ts'));
	assert.not.ok(isTaskPath('foo.task.js'));
	assert.ok(isTaskPath('bar/baz/foo.task.ts'));
	assert.not.ok(isTaskPath('bar/baz/foo.ts'));
});

test__isTaskPath.run();
/* test__isTaskPath */

/* test__toTaskName */
const test__toTaskName = suite('toTaskName');

test__toTaskName('basic behavior', () => {
	assert.is(toTaskName('foo.task.ts'), 'foo');
	assert.is(toTaskName('bar/baz/foo.task.ts'), 'bar/baz/foo');
});

test__toTaskName.run();
/* test__toTaskName */
