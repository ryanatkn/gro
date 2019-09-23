import * as fp from 'path';
const {resolve} = fp; // TODO esm

import {test} from './oki/index.js';
import {
	normalizeToId,
	toRootPath,
	toBasePath,
	basePathToBuildId,
	basePathToSourceId,
	toSourcePath,
	toBuildPath,
	toSourceId,
	toBuildId,
	hasSourceExt,
	toSourceExt,
	toBuildExt,
	toPathParts,
} from './paths.js';

test('toRootPath()', t => {
	t.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

test('toBasePath()', t => {
	test('sourceId', () => {
		t.is(toBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
	});
	test('buildId', () => {
		t.is(toBasePath(resolve('build/foo/bar/baz.js')), 'foo/bar/baz.js');
	});
});

test('toSourcePath()', t => {
	test('sourceId', () => {
		t.is(toSourcePath(resolve('src/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
	});
	test('sourceId with js extension', () => {
		t.is(toSourcePath(resolve('src/foo/bar/baz.js')), 'src/foo/bar/baz.js');
	});
	test('buildId', () => {
		t.is(toSourcePath(resolve('build/foo/bar/baz.js')), 'src/foo/bar/baz.ts');
	});
	test('buildId with ts extension', () => {
		t.is(toSourcePath(resolve('build/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
	});
});

test('toBuildPath()', t => {
	test('sourceId', () => {
		t.is(toBuildPath(resolve('src/foo/bar/baz.ts')), 'build/foo/bar/baz.js');
	});
	test('sourceId with js extension', () => {
		t.is(toBuildPath(resolve('src/foo/bar/baz.js')), 'build/foo/bar/baz.js');
	});
	test('buildId', () => {
		t.is(toBuildPath(resolve('build/foo/bar/baz.js')), 'build/foo/bar/baz.js');
	});
	test('buildId with ts extension', () => {
		t.is(toBuildPath(resolve('build/foo/bar/baz.ts')), 'build/foo/bar/baz.ts');
	});
});

test('toSourceId()', t => {
	test('sourceId', () => {
		t.is(
			toSourceId(resolve('src/foo/bar/baz.ts')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
	test('sourceId with js extension', () => {
		t.is(
			toSourceId(resolve('src/foo/bar/baz.js')),
			resolve('src/foo/bar/baz.js'),
		);
	});
	test('buildId', () => {
		t.is(
			toSourceId(resolve('build/foo/bar/baz.js')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
	test('buildId with ts extension', () => {
		t.is(
			toSourceId(resolve('build/foo/bar/baz.ts')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
});

test('toBuildId()', t => {
	test('sourceId', () => {
		t.is(
			toBuildId(resolve('src/foo/bar/baz.ts')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('sourceId with js extension', () => {
		t.is(
			toBuildId(resolve('src/foo/bar/baz.js')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildId', () => {
		t.is(
			toBuildId(resolve('build/foo/bar/baz.js')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildId with ts extension', () => {
		t.is(
			toBuildId(resolve('build/foo/bar/baz.ts')),
			resolve('build/foo/bar/baz.ts'),
		);
	});
});

test('basePathToSourceId()', t => {
	t.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	test('does not change extension', () => {
		t.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});
});
test('basePathToBuildId()', t => {
	t.is(basePathToBuildId('foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	test('does not change extension', () => {
		t.is(basePathToBuildId('foo/bar/baz.ts'), resolve('build/foo/bar/baz.ts'));
	});
});

test('normalizeToId()', t => {
	test('basePath with ts extension', () => {
		t.is(normalizeToId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('basePath with js extension', () => {
		t.is(normalizeToId('foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	});
	test('relative basePath with ts extension', () => {
		t.is(normalizeToId('./foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('relative basePath with js extension', () => {
		t.is(normalizeToId('./foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	});

	test('sourcePath', () => {
		t.is(normalizeToId('src/foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('relative sourcePath', () => {
		t.is(normalizeToId('./src/foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('sourcePath with js extension', () => {
		t.is(normalizeToId('src/foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});

	test('buildPath', () => {
		t.is(
			normalizeToId('build/foo/bar/baz.js'),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('relative buildPath', () => {
		t.is(
			normalizeToId('./build/foo/bar/baz.js'),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildPath with ts extension', () => {
		t.is(
			normalizeToId('build/foo/bar/baz.ts'),
			resolve('build/foo/bar/baz.ts'),
		);
	});

	test('sourceId', () => {
		t.is(
			normalizeToId(resolve('src/foo/bar/baz.ts')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
	test('sourceId with js extension', () => {
		t.is(
			normalizeToId(resolve('src/foo/bar/baz.js')),
			resolve('src/foo/bar/baz.js'),
		);
	});
	test('buildId', () => {
		t.is(
			normalizeToId(resolve('build/foo/bar/baz.js')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildId with ts extension', () => {
		t.is(
			normalizeToId(resolve('build/foo/bar/baz.ts')),
			resolve('build/foo/bar/baz.ts'),
		);
	});
});

test('hasSourceExt()', t => {
	test('typescript', () => {
		t.ok(hasSourceExt('foo/bar/baz.ts'));
	});
	test('svelte', () => {
		t.ok(hasSourceExt('foo/bar/baz.svelte'));
	});
});

test('toSourceExt()', t => {
	t.is(toSourceExt('foo/bar/baz.js'), 'foo/bar/baz.ts');
});

test('toBuildExt()', t => {
	test('typescript', () => {
		t.is(toBuildExt('foo/bar/baz.ts'), 'foo/bar/baz.js');
	});
	test('svelte', () => {
		t.is(toBuildExt('foo/bar/baz.svelte'), 'foo/bar/baz.js');
	});
});

test('toPathParts()', t => {
	t.equal(toPathParts('./foo/bar/baz.ts'), [
		'foo',
		'foo/bar',
		'foo/bar/baz.ts',
	]);
});
