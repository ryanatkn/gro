import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {paths} from '../paths.js';
import {to_hash, create_directory_filter} from './utils.js';

/* test_to_hash */
const test_to_hash = suite('to_hash');

test_to_hash('turns a buffer into a string', () => {
	t.type(to_hash(Buffer.from('hey')), 'string');
});

test_to_hash('returns the same value given the same input', () => {
	t.is(to_hash(Buffer.from('hey')), to_hash(Buffer.from('hey')));
});

test_to_hash.run();
/* /test_to_hash */

/* test_create_directory_filter */
const test_create_directory_filter = suite('create_directory_filter', {
	root_dir: resolve('bar'),
});

test_create_directory_filter('relative source path', () => {
	const filter = create_directory_filter('foo');
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

test_create_directory_filter('absolute source path', () => {
	const filter = create_directory_filter(join(paths.source, 'foo'));
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

test_create_directory_filter('relative path with custom root', ({root_dir}) => {
	const filter = create_directory_filter('foo', root_dir);
	t.ok(filter(join(root_dir, 'foo')));
	t.ok(filter(join(root_dir, 'foo/')));
	t.not.ok(filter(join(root_dir, 'fo')));
	t.not.ok(filter(join(root_dir, 'fo/')));
});

test_create_directory_filter('absolute path with custom root', ({root_dir}) => {
	const filter = create_directory_filter(join(root_dir, 'foo'), root_dir);
	t.ok(filter(join(root_dir, 'foo')));
	t.ok(filter(join(root_dir, 'foo/')));
	t.not.ok(filter(join(root_dir, 'fo')));
	t.not.ok(filter(join(root_dir, 'fo/')));
});

test_create_directory_filter.run();
/* /test_create_directory_filter */
