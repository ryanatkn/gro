import {test} from 'uvu';
import * as t from 'uvu/assert';

import {
	get_mime_type_by_extension,
	get_extensionsByMimeType,
	addMimeTypeExtension,
	removeMimeTypeExtension,
	get_extensions,
	getMimeTypes,
} from './mime.js';

test('get_mime_type_by_extension', () => {
	t.is(get_mime_type_by_extension('txt'), 'text/plain');
	t.is(get_mime_type_by_extension('log'), 'text/plain');
	t.is(get_mime_type_by_extension('js'), 'text/javascript');
	t.is(get_mime_type_by_extension('mjs'), 'text/javascript');
	t.is(get_mime_type_by_extension('json'), 'application/json');
	t.is(get_mime_type_by_extension('fakeext'), null);
});

test('get_extensionsByMimeType', () => {
	t.equal(get_extensionsByMimeType('text/plain'), ['txt', 'log']);
	t.equal(get_extensionsByMimeType('application/json'), ['json', 'map']);
	t.equal(get_extensionsByMimeType('text/javascript'), ['js', 'mjs']);
	t.equal(get_extensionsByMimeType('fake/test-type'), null);
});

test('get_extensions', () => {
	t.ok(Array.from(get_extensions()).length);
});

test('getMimeTypes', () => {
	t.ok(Array.from(getMimeTypes()).length);
});

test('addMimeTypeExtension', () => {
	addMimeTypeExtension('test/type', 'foo');
	addMimeTypeExtension('test/type', 'bar');
	addMimeTypeExtension('test/type', 'bar'); // add twice to make sure that's not a problem
	t.is(get_mime_type_by_extension('foo'), 'test/type');
	t.is(get_mime_type_by_extension('bar'), 'test/type');
	t.equal(get_extensionsByMimeType('test/type'), ['foo', 'bar']);
	t.ok(removeMimeTypeExtension('foo'));
	t.is(get_mime_type_by_extension('foo'), null);
	t.is(get_mime_type_by_extension('bar'), 'test/type');
	t.equal(get_extensionsByMimeType('test/type'), ['bar']);
	t.ok(removeMimeTypeExtension('bar'));
	t.is(get_mime_type_by_extension('foo'), null);
	t.is(get_mime_type_by_extension('bar'), null);
	t.equal(get_extensionsByMimeType('test/type'), null);
	t.not.ok(removeMimeTypeExtension('bar'));
});

test.run();
