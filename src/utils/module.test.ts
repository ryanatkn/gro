import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {isExternalModule} from './module.js';

/* testIsExternalModule */
const testIsExternalModule = suite('isExternalModule');

testIsExternalModule('internal browser module patterns', () => {
	t.is(isExternalModule('./foo'), false);
	t.is(isExternalModule('./foo.js'), false);
	t.is(isExternalModule('../foo'), false);
	t.is(isExternalModule('../foo.js'), false);
	t.is(isExternalModule('../../../foo'), false);
	t.is(isExternalModule('../../../foo.js'), false);
	t.is(isExternalModule('/foo'), false);
	t.is(isExternalModule('/foo.js'), false);
	t.is(isExternalModule('src/foo'), false);
	t.is(isExternalModule('src/foo.js'), false);
	t.is(isExternalModule('$lib/foo'), false);
	t.is(isExternalModule('$lib/foo.js'), false);
	t.is(isExternalModule('./foo/bar/baz'), false);
	t.is(isExternalModule('./foo/bar/baz.js'), false);
	t.is(isExternalModule('../foo/bar/baz'), false);
	t.is(isExternalModule('../foo/bar/baz.js'), false);
	t.is(isExternalModule('../../../foo/bar/baz'), false);
	t.is(isExternalModule('../../../foo/bar/baz.js'), false);
	t.is(isExternalModule('/foo/bar/baz'), false);
	t.is(isExternalModule('/foo/bar/baz.js'), false);
	t.is(isExternalModule('src/foo/bar/baz'), false);
	t.is(isExternalModule('src/foo/bar/baz.js'), false);
	t.is(isExternalModule('$lib/foo/bar/baz'), false);
	t.is(isExternalModule('$lib/foo/bar/baz.js'), false);
});

testIsExternalModule('external browser module patterns', () => {
	t.is(isExternalModule('foo'), true);
	t.is(isExternalModule('foo.js'), true);
	t.is(isExternalModule('foo/bar/baz'), true);
	t.is(isExternalModule('foo/bar/baz.js'), true);
	t.is(isExternalModule('@foo/bar/baz'), true);
	t.is(isExternalModule('@foo/bar/baz.js'), true);
});

testIsExternalModule.run();
/* /testIsExternalModule */
