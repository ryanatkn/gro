import {test, t} from '../oki/oki.js';

import {
	getMimeTypeByExtension,
	getExtensionsByMimeType,
	addMimeTypeExtension,
	removeMimeTypeExtension,
} from './mime.js';

test('extToMimeType()', () => {
	t.is(getMimeTypeByExtension('txt'), 'text/plain');
	t.is(getMimeTypeByExtension('log'), 'text/plain');
	t.is(getMimeTypeByExtension('js'), 'text/javascript');
	t.is(getMimeTypeByExtension('mjs'), 'text/javascript');
	t.is(getMimeTypeByExtension('fakeext'), null);
});

test('mimeTypeToExts()', () => {
	t.equal(getExtensionsByMimeType('text/plain'), ['txt', 'log']);
	t.equal(getExtensionsByMimeType('text/javascript'), ['js', 'mjs']);
	t.equal(getExtensionsByMimeType('fake/test-type'), null);
});

test('custom mime types', () => {
	addMimeTypeExtension('test/type', 'foo');
	addMimeTypeExtension('test/type', 'bar');
	addMimeTypeExtension('test/type', 'bar'); // add twice to make sure that's not a problem
	t.is(getMimeTypeByExtension('foo'), 'test/type');
	t.is(getMimeTypeByExtension('bar'), 'test/type');
	t.equal(getExtensionsByMimeType('test/type'), ['foo', 'bar']);
	t.ok(removeMimeTypeExtension('foo'));
	t.is(getMimeTypeByExtension('foo'), null);
	t.is(getMimeTypeByExtension('bar'), 'test/type');
	t.equal(getExtensionsByMimeType('test/type'), ['bar']);
	t.ok(removeMimeTypeExtension('bar'));
	t.is(getMimeTypeByExtension('foo'), null);
	t.is(getMimeTypeByExtension('bar'), null);
	t.equal(getExtensionsByMimeType('test/type'), null);
	t.notOk(removeMimeTypeExtension('bar'));
});
