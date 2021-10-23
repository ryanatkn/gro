import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {isExternalModule} from './module.js';

/* testIsExternalModule */
const testIsExternalModule = suite('isExternalModule');

testIsExternalModule('internal browser module patterns', () => {
	assert.is(isExternalModule('./foo'), false);
	assert.is(isExternalModule('./foo.js'), false);
	assert.is(isExternalModule('../foo'), false);
	assert.is(isExternalModule('../foo.js'), false);
	assert.is(isExternalModule('../../../foo'), false);
	assert.is(isExternalModule('../../../foo.js'), false);
	assert.is(isExternalModule('/foo'), false);
	assert.is(isExternalModule('/foo.js'), false);
	assert.is(isExternalModule('src/foo'), false);
	assert.is(isExternalModule('src/foo.js'), false);
	assert.is(isExternalModule('$lib/foo'), false);
	assert.is(isExternalModule('$lib/foo.js'), false);
	assert.is(isExternalModule('./foo/bar/baz'), false);
	assert.is(isExternalModule('./foo/bar/baz.js'), false);
	assert.is(isExternalModule('../foo/bar/baz'), false);
	assert.is(isExternalModule('../foo/bar/baz.js'), false);
	assert.is(isExternalModule('../../../foo/bar/baz'), false);
	assert.is(isExternalModule('../../../foo/bar/baz.js'), false);
	assert.is(isExternalModule('/foo/bar/baz'), false);
	assert.is(isExternalModule('/foo/bar/baz.js'), false);
	assert.is(isExternalModule('src/foo/bar/baz'), false);
	assert.is(isExternalModule('src/foo/bar/baz.js'), false);
	assert.is(isExternalModule('$lib/foo/bar/baz'), false);
	assert.is(isExternalModule('$lib/foo/bar/baz.js'), false);
});

testIsExternalModule('external browser module patterns', () => {
	assert.is(isExternalModule('foo'), true);
	assert.is(isExternalModule('foo.js'), true);
	assert.is(isExternalModule('foo/bar/baz'), true);
	assert.is(isExternalModule('foo/bar/baz.js'), true);
	assert.is(isExternalModule('@foo/bar/baz'), true);
	assert.is(isExternalModule('@foo/bar/baz.js'), true);
});

testIsExternalModule.run();
/* /testIsExternalModule */
