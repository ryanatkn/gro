import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {escape_bash} from './cli.js';

test('escape_bash', () => {
	assert.is(escape_bash('a b'), 'a b');
	assert.is(escape_bash('a" b'), 'a" b');
	assert.is(escape_bash("a' b"), "'a\\' b'");
	assert.is(escape_bash("'a' 'b'''"), "'\\'a\\' \\'b\\'\\'\\''");
	assert.is(escape_bash(''), "''");
});

test.run();
