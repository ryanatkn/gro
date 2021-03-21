import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {isExternalBrowserModule, isExternalNodeModule} from './module.js';

/* test_isExternalBrowserModule */
const test_isExternalBrowserModule = suite('isExternalBrowserModule');

test_isExternalBrowserModule('internal browser module patterns', () => {
	t.is(isExternalBrowserModule('./foo'), false);
	t.is(isExternalBrowserModule('./foo.js'), false);
	t.is(isExternalBrowserModule('../foo'), false);
	t.is(isExternalBrowserModule('../foo.js'), false);
	t.is(isExternalBrowserModule('../../../foo'), false);
	t.is(isExternalBrowserModule('../../../foo.js'), false);
	t.is(isExternalBrowserModule('/foo'), false);
	t.is(isExternalBrowserModule('/foo.js'), false);
	t.is(isExternalBrowserModule('./foo/bar/baz'), false);
	t.is(isExternalBrowserModule('./foo/bar/baz.js'), false);
	t.is(isExternalBrowserModule('../foo/bar/baz'), false);
	t.is(isExternalBrowserModule('../foo/bar/baz.js'), false);
	t.is(isExternalBrowserModule('../../../foo/bar/baz'), false);
	t.is(isExternalBrowserModule('../../../foo/bar/baz.js'), false);
	t.is(isExternalBrowserModule('/foo/bar/baz'), false);
	t.is(isExternalBrowserModule('/foo/bar/baz.js'), false);
});

test_isExternalBrowserModule('external browser module patterns', () => {
	t.is(isExternalBrowserModule('foo'), true);
	t.is(isExternalBrowserModule('foo.js'), true);
	t.is(isExternalBrowserModule('foo/bar/baz'), true);
	t.is(isExternalBrowserModule('foo/bar/baz.js'), true);
	t.is(isExternalBrowserModule('@foo/bar/baz'), true);
	t.is(isExternalBrowserModule('@foo/bar/baz.js'), true);
});

test_isExternalBrowserModule.run();
/* /test_isExternalBrowserModule */

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
