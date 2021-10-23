import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'path';

import {paths} from '../paths.js';
import {toHash, createDirectoryFilter} from './utils.js';

/* testToHash */
const testToHash = suite('toHash');

testToHash('turns a buffer into a string', () => {
	assert.type(toHash(Buffer.from('hey')), 'string');
});

testToHash('returns the same value given the same input', () => {
	assert.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

testToHash.run();
/* /testToHash */

/* testCreateDirectoryFilter */
const testCreateDirectoryFilter = suite('createDirectoryFilter', {
	rootDir: resolve('bar'),
});

testCreateDirectoryFilter('relative source path', () => {
	const filter = createDirectoryFilter('foo');
	assert.ok(filter(join(paths.source, 'foo')));
	assert.ok(filter(join(paths.source, 'foo/')));
	assert.not.ok(filter(join(paths.source, 'fo')));
	assert.not.ok(filter(join(paths.source, 'fo/')));
});

testCreateDirectoryFilter('absolute source path', () => {
	const filter = createDirectoryFilter(join(paths.source, 'foo'));
	assert.ok(filter(join(paths.source, 'foo')));
	assert.ok(filter(join(paths.source, 'foo/')));
	assert.not.ok(filter(join(paths.source, 'fo')));
	assert.not.ok(filter(join(paths.source, 'fo/')));
});

testCreateDirectoryFilter('relative path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter('foo', rootDir);
	assert.ok(filter(join(rootDir, 'foo')));
	assert.ok(filter(join(rootDir, 'foo/')));
	assert.not.ok(filter(join(rootDir, 'fo')));
	assert.not.ok(filter(join(rootDir, 'fo/')));
});

testCreateDirectoryFilter('absolute path with custom root', ({rootDir}) => {
	const filter = createDirectoryFilter(join(rootDir, 'foo'), rootDir);
	assert.ok(filter(join(rootDir, 'foo')));
	assert.ok(filter(join(rootDir, 'foo/')));
	assert.not.ok(filter(join(rootDir, 'fo')));
	assert.not.ok(filter(join(rootDir, 'fo/')));
});

testCreateDirectoryFilter.run();
/* /testCreateDirectoryFilter */
