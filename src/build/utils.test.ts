import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {paths} from '../paths.js';
import {toHash, createDirectoryFilter} from './utils.js';

/* test_toHash */
const test_toHash = suite('toHash');

test_toHash('turns a buffer into a string', () => {
	t.type(toHash(Buffer.from('hey')), 'string');
});

test_toHash('returns the same value given the same input', () => {
	t.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

test_toHash.run();
/* /test_toHash */

/* test_createDirectoryFilter */
const test_createDirectoryFilter = suite('createDirectoryFilter', {
	rootDir: resolve('bar'),
});

test_createDirectoryFilter('relative source path', () => {
	const filter = createDirectoryFilter('foo');
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.ok(!filter(join(paths.source, 'fo')));
	t.ok(!filter(join(paths.source, 'fo/')));
});

test_createDirectoryFilter('absolute source path', () => {
	const filter = createDirectoryFilter(join(paths.source, 'foo'));
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.ok(!filter(join(paths.source, 'fo')));
	t.ok(!filter(join(paths.source, 'fo/')));
});

test_createDirectoryFilter('relative path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter('foo', rootDir);
	t.ok(filter(join(rootDir, 'foo')));
	t.ok(filter(join(rootDir, 'foo/')));
	t.ok(!filter(join(rootDir, 'fo')));
	t.ok(!filter(join(rootDir, 'fo/')));
});

test_createDirectoryFilter('absolute path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter(join(rootDir, 'foo'), rootDir);
	t.ok(filter(join(rootDir, 'foo')));
	t.ok(filter(join(rootDir, 'foo/')));
	t.ok(!filter(join(rootDir, 'fo')));
	t.ok(!filter(join(rootDir, 'fo/')));
});

test_createDirectoryFilter.run();
/* /test_createDirectoryFilter */
