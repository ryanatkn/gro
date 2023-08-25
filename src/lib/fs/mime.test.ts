import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	getMimeTypeByExtension,
	getExtensionsByMimeType,
	addMimeTypeExtension,
	removeMimeTypeExtension,
	getExtensions,
	getMimeTypes,
} from './mime.js';

test('getMimeTypeByExtension', () => {
	assert.is(getMimeTypeByExtension('txt'), 'text/plain');
	assert.is(getMimeTypeByExtension('log'), 'text/plain');
	assert.is(getMimeTypeByExtension('js'), 'text/javascript');
	assert.is(getMimeTypeByExtension('mjs'), 'text/javascript');
	assert.is(getMimeTypeByExtension('json'), 'application/json');
	assert.is(getMimeTypeByExtension('fakeext'), null);
});

test('getExtensionsByMimeType', () => {
	assert.equal(getExtensionsByMimeType('text/plain'), ['txt', 'log']);
	assert.equal(getExtensionsByMimeType('application/json'), ['json', 'map']);
	assert.equal(getExtensionsByMimeType('text/javascript'), ['js', 'mjs']);
	assert.equal(getExtensionsByMimeType('fake/test-type'), null);
});

test('getExtensions', () => {
	assert.ok(Array.from(getExtensions()).length);
});

test('getMimeTypes', () => {
	assert.ok(Array.from(getMimeTypes()).length);
});

test('addMimeTypeExtension', () => {
	addMimeTypeExtension('test/type', 'foo');
	addMimeTypeExtension('test/type', 'bar');
	addMimeTypeExtension('test/type', 'bar'); // add twice to make sure that's not a problem
	assert.is(getMimeTypeByExtension('foo'), 'test/type');
	assert.is(getMimeTypeByExtension('bar'), 'test/type');
	assert.equal(getExtensionsByMimeType('test/type'), ['foo', 'bar']);
	assert.ok(removeMimeTypeExtension('foo'));
	assert.is(getMimeTypeByExtension('foo'), null);
	assert.is(getMimeTypeByExtension('bar'), 'test/type');
	assert.equal(getExtensionsByMimeType('test/type'), ['bar']);
	assert.ok(removeMimeTypeExtension('bar'));
	assert.is(getMimeTypeByExtension('foo'), null);
	assert.is(getMimeTypeByExtension('bar'), null);
	assert.equal(getExtensionsByMimeType('test/type'), null);
	assert.ok(!removeMimeTypeExtension('bar'));
});

test.run();
