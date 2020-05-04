import {resolve, join, sep} from 'path';

import {test, t} from './oki/oki.js';
import {
	createPaths,
	paths,
	groPaths,
	toRootPath,
	toBasePath,
	basePathToSourceId,
	basePathToBuildId,
	basePathToDistId,
	toSourcePath,
	toBuildPath,
	toDistPath,
	toSourceId,
	toBuildId,
	hasSourceExt,
	toSourceExt,
	toCompiledExt,
	toPathParts,
	toPathSegments,
	toImportId,
} from './paths.js';

test('createPaths()', () => {
	const root = resolve('../fake');
	const p = createPaths(root);
	t.is(p.root, join(root, sep));
	t.is(p.source, join(root, 'src/'));
});

test('paths object has the same identity as the groPaths object', () => {
	t.is(paths, groPaths);
});

test('toRootPath()', () => {
	t.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

test('toBasePath()', () => {
	test('sourceId', () => {
		t.is(toBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
	});
	test('buildId', () => {
		t.is(toBasePath(resolve('build/foo/bar/baz.js')), 'foo/bar/baz.js');
	});
	test('distId', () => {
		t.is(toBasePath(resolve('dist/foo/bar/baz.js')), 'foo/bar/baz.js');
	});
});

test('toSourcePath()', () => {
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
	test('distId', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.js')), 'src/foo/bar/baz.ts');
	});
	test('distId with ts extension', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
	});
});

test('toBuildPath()', () => {
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
	test('distId', () => {
		t.is(toBuildPath(resolve('dist/foo/bar/baz.js')), 'build/foo/bar/baz.js');
	});
	test('distId with ts extension', () => {
		t.is(toBuildPath(resolve('dist/foo/bar/baz.ts')), 'build/foo/bar/baz.ts');
	});
});

test('toDistPath()', () => {
	test('sourceId', () => {
		t.is(toDistPath(resolve('src/foo/bar/baz.ts')), 'dist/foo/bar/baz.js');
	});
	test('sourceId with js extension', () => {
		t.is(toDistPath(resolve('src/foo/bar/baz.js')), 'dist/foo/bar/baz.js');
	});
	test('buildId', () => {
		t.is(toDistPath(resolve('build/foo/bar/baz.js')), 'dist/foo/bar/baz.js');
	});
	test('buildId with ts extension', () => {
		t.is(toDistPath(resolve('build/foo/bar/baz.ts')), 'dist/foo/bar/baz.ts');
	});
	test('distId', () => {
		t.is(toDistPath(resolve('dist/foo/bar/baz.js')), 'dist/foo/bar/baz.js');
	});
	test('distId with ts extension', () => {
		t.is(toDistPath(resolve('dist/foo/bar/baz.ts')), 'dist/foo/bar/baz.ts');
	});
});

test('toSourceId()', () => {
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
	test('distId', () => {
		t.is(
			toSourceId(resolve('dist/foo/bar/baz.js')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
	test('distId with ts extension', () => {
		t.is(
			toSourceId(resolve('dist/foo/bar/baz.ts')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
});

test('toBuildId()', () => {
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
	test('distId', () => {
		t.is(
			toBuildId(resolve('build/foo/bar/baz.js')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('distId with ts extension', () => {
		t.is(
			toBuildId(resolve('build/foo/bar/baz.ts')),
			resolve('build/foo/bar/baz.ts'),
		);
	});
});

test('basePathToSourceId()', () => {
	t.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	test('does not change extension', () => {
		t.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});
});
test('basePathToBuildId()', () => {
	t.is(basePathToBuildId('foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	test('does not change extension', () => {
		t.is(basePathToBuildId('foo/bar/baz.ts'), resolve('build/foo/bar/baz.ts'));
	});
});
test('basePathToDistId()', () => {
	t.is(basePathToDistId('foo/bar/baz.js'), resolve('dist/foo/bar/baz.js'));
	test('does not change extension', () => {
		t.is(basePathToDistId('foo/bar/baz.ts'), resolve('dist/foo/bar/baz.ts'));
	});
});

test('hasSourceExt()', () => {
	test('typescript', () => {
		t.ok(hasSourceExt('foo/bar/baz.ts'));
	});
	test('svelte', () => {
		t.ok(hasSourceExt('foo/bar/baz.svelte'));
	});
});

test('toSourceExt()', () => {
	t.is(toSourceExt('foo/bar/baz.js'), 'foo/bar/baz.ts');
});

test('toCompiledExt()', () => {
	test('typescript', () => {
		t.is(toCompiledExt('foo/bar/baz.ts'), 'foo/bar/baz.js');
	});
	test('svelte', () => {
		t.is(toCompiledExt('foo/bar/baz.svelte'), 'foo/bar/baz.js');
	});
});

test('toPathSegments()', () => {
	t.equal(toPathSegments('foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	test('leading dot', () => {
		t.equal(toPathSegments('./foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	});
	test('leading slash', () => {
		t.equal(toPathSegments('/foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	});
	test('trailing slash', () => {
		t.equal(toPathSegments('foo/bar/baz/'), ['foo', 'bar', 'baz']);
	});
});

test('toPathParts()', () => {
	t.equal(toPathParts('foo/bar/baz.ts'), ['foo', 'foo/bar', 'foo/bar/baz.ts']);
	test('leading dot', () => {
		t.equal(toPathParts('./foo/bar/baz.ts'), [
			'foo',
			'foo/bar',
			'foo/bar/baz.ts',
		]);
	});
	test('leading slash', () => {
		t.equal(toPathParts('/foo/bar/baz.ts'), [
			'/foo',
			'/foo/bar',
			'/foo/bar/baz.ts',
		]);
	});
	test('trailing slash', () => {
		t.equal(toPathParts('foo/bar/baz/'), ['foo', 'foo/bar', 'foo/bar/baz']);
	});
});

test('toImportId()', () => {
	t.is(toImportId(resolve('src/foo/bar.ts')), resolve('build/foo/bar.js'));
});
