import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join} from 'path';

import {paths} from '../paths.js';
import {toHash, createDirectoryFilter} from './utils.js';

/* testToHash */
const testToHash = suite('toHash');

testToHash('turns a buffer into a string', () => {
	t.type(toHash(Buffer.from('hey')), 'string');
});

testToHash('returns the same value given the same input', () => {
	t.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

testToHash.run();
/* /testToHash */

/* testCreateDirectoryFilter */
const testCreateDirectoryFilter = suite('createDirectoryFilter', {
	rootDir: resolve('bar'),
});

testCreateDirectoryFilter('relative source path', () => {
	const filter = createDirectoryFilter('foo');
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

testCreateDirectoryFilter('absolute source path', () => {
	const filter = createDirectoryFilter(join(paths.source, 'foo'));
	t.ok(filter(join(paths.source, 'foo')));
	t.ok(filter(join(paths.source, 'foo/')));
	t.not.ok(filter(join(paths.source, 'fo')));
	t.not.ok(filter(join(paths.source, 'fo/')));
});

testCreateDirectoryFilter('relative path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter('foo', rootDir);
	t.ok(filter(join(rootDir, 'foo')));
	t.ok(filter(join(rootDir, 'foo/')));
	t.not.ok(filter(join(rootDir, 'fo')));
	t.not.ok(filter(join(rootDir, 'fo/')));
});

testCreateDirectoryFilter('absolute path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter(join(rootDir, 'foo'), rootDir);
	t.ok(filter(join(rootDir, 'foo')));
	t.ok(filter(join(rootDir, 'foo/')));
	t.not.ok(filter(join(rootDir, 'fo')));
	t.not.ok(filter(join(rootDir, 'fo/')));
});

testCreateDirectoryFilter.run();
/* /testCreateDirectoryFilter */
