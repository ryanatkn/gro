import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {paths} from '../paths.js';
import {to_hash, createDirectoryFilter} from './utils.js';

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

/* test_createDirectoryFilter */
const test_createDirectoryFilter = suite('createDirectoryFilter', {
	root_dir: resolve('bar'),
});

test_createDirectoryFilter('relative source path', () => {
	const filter = createDirectoryFilter('foo');
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

test_createDirectoryFilter('absolute source path', () => {
	const filter = createDirectoryFilter(join(paths.source, 'foo'));
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

test_createDirectoryFilter('relative path with custom root', ({root_dir}) => {
	const filter = createDirectoryFilter('foo', root_dir);
	t.ok(filter(join(root_dir, 'foo')));
	t.ok(filter(join(root_dir, 'foo/')));
	t.not.ok(filter(join(root_dir, 'fo')));
	t.not.ok(filter(join(root_dir, 'fo/')));
});

test_createDirectoryFilter('absolute path with custom root', ({root_dir}) => {
	const filter = createDirectoryFilter(join(root_dir, 'foo'), root_dir);
	t.ok(filter(join(root_dir, 'foo')));
	t.ok(filter(join(root_dir, 'foo/')));
	t.not.ok(filter(join(root_dir, 'fo')));
	t.not.ok(filter(join(root_dir, 'fo/')));
});

test_createDirectoryFilter.run();
/* /test_createDirectoryFilter */
