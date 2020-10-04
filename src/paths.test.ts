import {resolve, join, sep} from 'path';

import {test, t} from './oki/oki.js';
import {
	createPaths,
	paths,
	groPaths,
	isGroId,
	toRootPath,
	toBasePath,
	basePathToSourceId,
	toSourcePath,
	hasSourceExtension,
	toSourceExtension,
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
	t.is(paths, groPaths); // because we're testing inside the Gro project
});

test('isGroId()', () => {
	t.ok(isGroId(resolve(paths.source)));
	t.ok(!isGroId(resolve('../fake/src')));
});

test('toRootPath()', () => {
	t.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

test('toBasePath()', () => {
	test('sourceId', () => {
		t.is(toBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
	});
	test('buildId', () => {
		t.is(toBasePath(resolve('.gro/foo/bar/baz.js')), 'foo/bar/baz.js');
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
		t.is(toSourcePath(resolve('.gro/foo/bar/baz.js')), 'src/foo/bar/baz.ts');
	});
	test('buildId with ts extension', () => {
		t.is(toSourcePath(resolve('.gro/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
	});
	test('distId', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.js')), 'src/foo/bar/baz.ts');
	});
	test('distId with ts extension', () => {
		t.is(toSourcePath(resolve('dist/foo/bar/baz.ts')), 'src/foo/bar/baz.ts');
	});
});

test('basePathToSourceId()', () => {
	t.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	test('does not change extension', () => {
		t.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});
});

test('hasSourceExtension()', () => {
	test('typescript', () => {
		t.ok(hasSourceExtension('foo/bar/baz.ts'));
	});
	test('svelte', () => {
		t.ok(hasSourceExtension('foo/bar/baz.svelte'));
	});
});

test('toSourceExtension()', () => {
	t.is(toSourceExtension('foo/bar/baz.js'), 'foo/bar/baz.ts');
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
		t.equal(toPathParts('./foo/bar/baz.ts'), ['foo', 'foo/bar', 'foo/bar/baz.ts']);
	});
	test('leading slash', () => {
		t.equal(toPathParts('/foo/bar/baz.ts'), ['/foo', '/foo/bar', '/foo/bar/baz.ts']);
	});
	test('trailing slash', () => {
		t.equal(toPathParts('foo/bar/baz/'), ['foo', 'foo/bar', 'foo/bar/baz']);
	});
});

test('toImportId()', () => {
	t.is(toImportId(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	t.is(toImportId(resolve('src/foo/bar.ts'), false, 'baz'), resolve('.gro/prod/baz/foo/bar.js'));
});
