import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {is_external_module} from './module.js';

/* test__is_external_module */
const test__is_external_module = suite('is_external_module');

test__is_external_module('internal browser module patterns', () => {
	assert.is(is_external_module('./foo'), false);
	assert.is(is_external_module('./foo.js'), false);
	assert.is(is_external_module('../foo'), false);
	assert.is(is_external_module('../foo.js'), false);
	assert.is(is_external_module('../../../foo'), false);
	assert.is(is_external_module('../../../foo.js'), false);
	assert.is(is_external_module('/foo'), false);
	assert.is(is_external_module('/foo.js'), false);
	assert.is(is_external_module('src/foo'), false);
	assert.is(is_external_module('src/foo.js'), false);
	assert.is(is_external_module('$lib/foo'), false);
	assert.is(is_external_module('$lib/foo.js'), false);
	assert.is(is_external_module('./foo/bar/baz'), false);
	assert.is(is_external_module('./foo/bar/baz.js'), false);
	assert.is(is_external_module('../foo/bar/baz'), false);
	assert.is(is_external_module('../foo/bar/baz.js'), false);
	assert.is(is_external_module('../../../foo/bar/baz'), false);
	assert.is(is_external_module('../../../foo/bar/baz.js'), false);
	assert.is(is_external_module('/foo/bar/baz'), false);
	assert.is(is_external_module('/foo/bar/baz.js'), false);
	assert.is(is_external_module('src/foo/bar/baz'), false);
	assert.is(is_external_module('src/foo/bar/baz.js'), false);
	assert.is(is_external_module('$lib/foo/bar/baz'), false);
	assert.is(is_external_module('$lib/foo/bar/baz.js'), false);
});

test__is_external_module('external browser module patterns', () => {
	assert.is(is_external_module('foo'), true);
	assert.is(is_external_module('foo.js'), true);
	assert.is(is_external_module('foo/bar/baz'), true);
	assert.is(is_external_module('foo/bar/baz.js'), true);
	assert.is(is_external_module('@foo/bar/baz'), true);
	assert.is(is_external_module('@foo/bar/baz.js'), true);
});

test__is_external_module.run();
/* test__is_external_module */
