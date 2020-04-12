import {resolve} from 'path';

import {test} from './oki/oki.js';
import {
	toInferredId,
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
	test('distId', () => {
		t.is(toBasePath(resolve('dist/foo/bar/baz.js')), 'foo/bar/baz.js');
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
	test('distId', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.js')), 'src/foo/bar/baz.ts');
	});
	test('distId with ts extension', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
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
	test('distId', () => {
		t.is(toBuildPath(resolve('dist/foo/bar/baz.js')), 'build/foo/bar/baz.js');
	});
	test('distId with ts extension', () => {
		t.is(toBuildPath(resolve('dist/foo/bar/baz.ts')), 'build/foo/bar/baz.ts');
	});
});

test('toDistPath()', t => {
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
test('basePathToDistId()', t => {
	t.is(basePathToDistId('foo/bar/baz.js'), resolve('dist/foo/bar/baz.js'));
	test('does not change extension', () => {
		t.is(basePathToDistId('foo/bar/baz.ts'), resolve('dist/foo/bar/baz.ts'));
	});
});

test('toInferredId()', t => {
	test('basePath with ts extension', () => {
		t.is(toInferredId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('basePath with js extension', () => {
		t.is(toInferredId('foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	});
	test('relative basePath with ts extension', () => {
		t.is(toInferredId('./foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('relative basePath with js extension', () => {
		t.is(toInferredId('./foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	});

	test('sourcePath', () => {
		t.is(toInferredId('src/foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('relative sourcePath', () => {
		t.is(toInferredId('./src/foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	});
	test('sourcePath with js extension', () => {
		t.is(toInferredId('src/foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});

	test('buildPath', () => {
		t.is(toInferredId('build/foo/bar/baz.js'), resolve('build/foo/bar/baz.js'));
	});
	test('relative buildPath', () => {
		t.is(
			toInferredId('./build/foo/bar/baz.js'),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildPath with ts extension', () => {
		t.is(toInferredId('build/foo/bar/baz.ts'), resolve('build/foo/bar/baz.ts'));
	});

	test('distPath', () => {
		t.is(toInferredId('dist/foo/bar/baz.js'), resolve('dist/foo/bar/baz.js'));
	});
	test('relative distPath', () => {
		t.is(toInferredId('./dist/foo/bar/baz.js'), resolve('dist/foo/bar/baz.js'));
	});
	test('distPath with ts extension', () => {
		t.is(toInferredId('dist/foo/bar/baz.ts'), resolve('dist/foo/bar/baz.ts'));
	});

	test('sourceId', () => {
		t.is(
			toInferredId(resolve('src/foo/bar/baz.ts')),
			resolve('src/foo/bar/baz.ts'),
		);
	});
	test('sourceId with js extension', () => {
		t.is(
			toInferredId(resolve('src/foo/bar/baz.js')),
			resolve('src/foo/bar/baz.js'),
		);
	});
	test('buildId', () => {
		t.is(
			toInferredId(resolve('build/foo/bar/baz.js')),
			resolve('build/foo/bar/baz.js'),
		);
	});
	test('buildId with ts extension', () => {
		t.is(
			toInferredId(resolve('build/foo/bar/baz.ts')),
			resolve('build/foo/bar/baz.ts'),
		);
	});
	test('distId', () => {
		t.is(
			toInferredId(resolve('dist/foo/bar/baz.js')),
			resolve('dist/foo/bar/baz.js'),
		);
	});
	test('distId with ts extension', () => {
		t.is(
			toInferredId(resolve('dist/foo/bar/baz.ts')),
			resolve('dist/foo/bar/baz.ts'),
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

test('toCompiledExt()', t => {
	test('typescript', () => {
		t.is(toCompiledExt('foo/bar/baz.ts'), 'foo/bar/baz.js');
	});
	test('svelte', () => {
		t.is(toCompiledExt('foo/bar/baz.svelte'), 'foo/bar/baz.js');
	});
});

test('toPathSegments()', t => {
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

test('toPathParts()', t => {
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
