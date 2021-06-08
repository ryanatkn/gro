import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {is_external_browser_module, isExternalNodeModule} from './module.js';

/* test_is_external_browser_module */
const test_is_external_browser_module = suite('is_external_browser_module');

test_is_external_browser_module('internal browser module patterns', () => {
	t.is(is_external_browser_module('./foo'), false);
	t.is(is_external_browser_module('./foo.js'), false);
	t.is(is_external_browser_module('../foo'), false);
	t.is(is_external_browser_module('../foo.js'), false);
	t.is(is_external_browser_module('../../../foo'), false);
	t.is(is_external_browser_module('../../../foo.js'), false);
	t.is(is_external_browser_module('/foo'), false);
	t.is(is_external_browser_module('/foo.js'), false);
	t.is(is_external_browser_module('./foo/bar/baz'), false);
	t.is(is_external_browser_module('./foo/bar/baz.js'), false);
	t.is(is_external_browser_module('../foo/bar/baz'), false);
	t.is(is_external_browser_module('../foo/bar/baz.js'), false);
	t.is(is_external_browser_module('../../../foo/bar/baz'), false);
	t.is(is_external_browser_module('../../../foo/bar/baz.js'), false);
	t.is(is_external_browser_module('/foo/bar/baz'), false);
	t.is(is_external_browser_module('/foo/bar/baz.js'), false);
});

test_is_external_browser_module('external browser module patterns', () => {
	t.is(is_external_browser_module('foo'), true);
	t.is(is_external_browser_module('foo.js'), true);
	t.is(is_external_browser_module('foo/bar/baz'), true);
	t.is(is_external_browser_module('foo/bar/baz.js'), true);
	t.is(is_external_browser_module('@foo/bar/baz'), true);
	t.is(is_external_browser_module('@foo/bar/baz.js'), true);
});

test_is_external_browser_module.run();
/* /test_is_external_browser_module */

/* test_isExternalNodeModule */
const test_isExternalNodeModule = suite('isExternalNodeModule');
test_isExternalNodeModule('internal Node module patterns', () => {
	t.is(isExternalNodeModule('./foo'), false);
	t.is(isExternalNodeModule('./foo.js'), false);
	t.is(isExternalNodeModule('../foo'), false);
	t.is(isExternalNodeModule('../foo.js'), false);
	t.is(isExternalNodeModule('../../../foo'), false);
	t.is(isExternalNodeModule('../../../foo.js'), false);
	t.is(isExternalNodeModule('./foo/bar/baz'), false);
	t.is(isExternalNodeModule('./foo/bar/baz.js'), false);
	t.is(isExternalNodeModule('../foo/bar/baz'), false);
	t.is(isExternalNodeModule('../foo/bar/baz.js'), false);
	t.is(isExternalNodeModule('../../../foo/bar/baz'), false);
	t.is(isExternalNodeModule('../../../foo/bar/baz.js'), false);
});

test_isExternalNodeModule('external Node module patterns', () => {
	t.is(isExternalNodeModule('foo'), true);
	t.is(isExternalNodeModule('foo.js'), true);
	t.is(isExternalNodeModule('/foo'), true);
	t.is(isExternalNodeModule('/foo.js'), true);
	t.is(isExternalNodeModule('foo/bar/baz'), true);
	t.is(isExternalNodeModule('foo/bar/baz.js'), true);
	t.is(isExternalNodeModule('/foo/bar/baz'), true);
	t.is(isExternalNodeModule('/foo/bar/baz.js'), true);
	t.is(isExternalNodeModule('@foo/bar/baz'), true);
	t.is(isExternalNodeModule('@foo/bar/baz.js'), true);
});

test_isExternalNodeModule.run();
/* /test_isExternalNodeModule */
