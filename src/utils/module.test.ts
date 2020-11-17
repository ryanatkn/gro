import {test, t} from '../oki/oki.js';
import {isExternalBrowserModule, isExternalNodeModule} from './module.js';

test('isExternalBrowserModule()', () => {
	// internal browser module patterns
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

	// external browser module patterns
	t.is(isExternalBrowserModule('foo'), true);
	t.is(isExternalBrowserModule('foo.js'), true);
	t.is(isExternalBrowserModule('foo/bar/baz'), true);
	t.is(isExternalBrowserModule('foo/bar/baz.js'), true);
	t.is(isExternalBrowserModule('@foo/bar/baz'), true);
	t.is(isExternalBrowserModule('@foo/bar/baz.js'), true);
});

test('isExternalNodeModule()', () => {
	// internal Node module patterns
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

	// external Node module patterns
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
