import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';

import {paths} from '../paths.js';
import {toHash, createDirectoryFilter} from './utils.js';

/* test__toHash */
const test__toHash = suite('toHash');

test__toHash('turns a buffer into a string', () => {
	assert.type(toHash(Buffer.from('hey')), 'string');
});

test__toHash('returns the same value given the same input', () => {
	assert.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

test__toHash.run();
/* test__toHash */

/* test__createDirectoryFilter */
const test__createDirectoryFilter = suite('createDirectoryFilter', {
	rootDir: resolve('bar'),
});

test__createDirectoryFilter('relative source path', () => {
	const filter = createDirectoryFilter('foo');
	assert.ok(filter(join(paths.source, 'foo')));
	assert.ok(filter(join(paths.source, 'foo/')));
	assert.ok(!filter(join(paths.source, 'fo')));
	assert.ok(!filter(join(paths.source, 'fo/')));
});

test__createDirectoryFilter('absolute source path', () => {
	const filter = createDirectoryFilter(join(paths.source, 'foo'));
	assert.ok(filter(join(paths.source, 'foo')));
	assert.ok(filter(join(paths.source, 'foo/')));
	assert.ok(!filter(join(paths.source, 'fo')));
	assert.ok(!filter(join(paths.source, 'fo/')));
});

test__createDirectoryFilter('relative path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter('foo', rootDir);
	assert.ok(filter(join(rootDir, 'foo')));
	assert.ok(filter(join(rootDir, 'foo/')));
	assert.ok(!filter(join(rootDir, 'fo')));
	assert.ok(!filter(join(rootDir, 'fo/')));
});

test__createDirectoryFilter('absolute path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter(join(rootDir, 'foo'), rootDir);
	assert.ok(filter(join(rootDir, 'foo')));
	assert.ok(filter(join(rootDir, 'foo/')));
	assert.ok(!filter(join(rootDir, 'fo')));
	assert.ok(!filter(join(rootDir, 'fo/')));
});

test__createDirectoryFilter.run();
/* test__createDirectoryFilter */
