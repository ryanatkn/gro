import {test} from 'uvu';
import * as t from 'uvu/assert';

import {
	get_mime_type_by_extension,
	get_extensions_by_mime_type,
	add_mime_type_extension,
	remove_mime_type_extension,
	get_extensions,
	get_mime_types,
} from './mime.js';

test('get_mime_type_by_extension', () => {
	t.is(get_mime_type_by_extension('txt'), 'text/plain');
	t.is(get_mime_type_by_extension('log'), 'text/plain');
	t.is(get_mime_type_by_extension('js'), 'text/javascript');
	t.is(get_mime_type_by_extension('mjs'), 'text/javascript');
	t.is(get_mime_type_by_extension('json'), 'application/json');
	t.is(get_mime_type_by_extension('fakeext'), null);
});

test('get_extensions_by_mime_type', () => {
	t.equal(get_extensions_by_mime_type('text/plain'), ['txt', 'log']);
	t.equal(get_extensions_by_mime_type('application/json'), ['json', 'map']);
	t.equal(get_extensions_by_mime_type('text/javascript'), ['js', 'mjs']);
	t.equal(get_extensions_by_mime_type('fake/test-type'), null);
});

test('get_extensions', () => {
	t.ok(Array.from(get_extensions()).length);
});

test('get_mime_types', () => {
	t.ok(Array.from(get_mime_types()).length);
});

test('add_mime_type_extension', () => {
	add_mime_type_extension('test/type', 'foo');
	add_mime_type_extension('test/type', 'bar');
	add_mime_type_extension('test/type', 'bar'); // add twice to make sure that's not a problem
	t.is(get_mime_type_by_extension('foo'), 'test/type');
	t.is(get_mime_type_by_extension('bar'), 'test/type');
	t.equal(get_extensions_by_mime_type('test/type'), ['foo', 'bar']);
	t.ok(remove_mime_type_extension('foo'));
	t.is(get_mime_type_by_extension('foo'), null);
	t.is(get_mime_type_by_extension('bar'), 'test/type');
	t.equal(get_extensions_by_mime_type('test/type'), ['bar']);
	t.ok(remove_mime_type_extension('bar'));
	t.is(get_mime_type_by_extension('foo'), null);
	t.is(get_mime_type_by_extension('bar'), null);
	t.equal(get_extensions_by_mime_type('test/type'), null);
	t.not.ok(remove_mime_type_extension('bar'));
});

test.run();
