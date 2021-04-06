import {test} from 'uvu';
import * as t from 'uvu/assert';

import {
	getMimeTypeByExtension,
	getExtensionsByMimeType,
	addMimeTypeExtension,
	removeMimeTypeExtension,
	getExtensions,
	getMimeTypes,
} from './mime.js';

test('getMimeTypeByExtension', () => {
	t.is(getMimeTypeByExtension('txt'), 'text/plain');
	t.is(getMimeTypeByExtension('log'), 'text/plain');
	t.is(getMimeTypeByExtension('js'), 'text/javascript');
	t.is(getMimeTypeByExtension('mjs'), 'text/javascript');
	t.is(getMimeTypeByExtension('json'), 'application/json');
	t.is(getMimeTypeByExtension('fakeext'), null);
});

test('getExtensionsByMimeType', () => {
	t.equal(getExtensionsByMimeType('text/plain'), ['txt', 'log']);
	t.equal(getExtensionsByMimeType('application/json'), ['json', 'map']);
	t.equal(getExtensionsByMimeType('text/javascript'), ['js', 'mjs']);
	t.equal(getExtensionsByMimeType('fake/test-type'), null);
});

test('getExtensions', () => {
	t.ok(Array.from(getExtensions()).length);
});

test('getMimeTypes', () => {
	t.ok(Array.from(getMimeTypes()).length);
});

test('addMimeTypeExtension', () => {
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
	t.not.ok(removeMimeTypeExtension('bar'));
});

test.run();
