import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {paths} from '../paths.js';
import {toHash, createDirectoryFilter} from './utils.js';

test('toHash()', () => {
	t.is(typeof toHash(Buffer.from('hey')), 'string');
	t.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

test('createDirectoryFilter()', () => {
	const rootDir = resolve('bar');
	test('relative source path', () => {
		const filter = createDirectoryFilter('foo');
		t.ok(filter(join(paths.source, 'foo')));
		t.ok(filter(join(paths.source, 'foo/')));
		t.ok(!filter(join(paths.source, 'fo')));
		t.ok(!filter(join(paths.source, 'fo/')));
	});
	test('absolute source path', () => {
		const filter = createDirectoryFilter(join(paths.source, 'foo'));
		t.ok(filter(join(paths.source, 'foo')));
		t.ok(filter(join(paths.source, 'foo/')));
		t.ok(!filter(join(paths.source, 'fo')));
		t.ok(!filter(join(paths.source, 'fo/')));
	});
	test('relative path with custom root', () => {
		const filter = createDirectoryFilter('foo', rootDir);
		t.ok(filter(join(rootDir, 'foo')));
		t.ok(filter(join(rootDir, 'foo/')));
		t.ok(!filter(join(rootDir, 'fo')));
		t.ok(!filter(join(rootDir, 'fo/')));
	});
	test('absolute path with custom root', () => {
		const filter = createDirectoryFilter(join(rootDir, 'foo'), rootDir);
		t.ok(filter(join(rootDir, 'foo')));
		t.ok(filter(join(rootDir, 'foo/')));
		t.ok(!filter(join(rootDir, 'fo')));
		t.ok(!filter(join(rootDir, 'fo/')));
	});
});

// test('mapBuildIdToSourceId()', () => {
// 	// TODO is trailing slash not there on build?? also, change this helper??
// 	console.log('paths.build', paths.build);
// 	t.is(mapBuildIdToSourceId(`${paths.build}/dev/externals/svelte/store.js`, true), 'svelte/store');
// 	t.is(
// 		mapBuildIdToSourceId(`${paths.build}/dev/externals/svelte/motion/index.js`, true),
// 		'svelte/motion/index',
// 	);
// 	t.is(
// 		mapBuildIdToSourceId(`${paths.build}/dev/externals/svelte/motion/index.js`, false),
// 		paths.source + 'svelte/motion/index.ts',
// 	);
// 	t.is(
// 		mapBuildIdToSourceId(`${paths.build}/dev/foo/index.js`, false),
// 		`${paths.source}foo/index.ts`,
// 	);
// });
