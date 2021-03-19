import {resolve, join, sep} from 'path';

import {test, t} from './oki/oki.js';
import {
	createPaths,
	paths,
	groPaths,
	isGroId,
	toRootPath,
	sourceIdToBasePath,
	basePathToSourceId,
	hasSourceExtension,
	toImportId,
	toBuildExtension,
	toSourceExtension,
	toBuildBasePath,
	EXTERNALS_BUILD_DIR,
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

test('sourceIdToBasePath()', () => {
	test('sourceId', () => {
		t.is(sourceIdToBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
	});
});

test('basePathToSourceId()', () => {
	t.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
	test('does not change extension', () => {
		t.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
	});
});

// TODO !
// test('toBuildOutDir()', () => {});
// test('toBuildOutPath()', () => {});

test('toBuildBasePath()', () => {
	t.is(toBuildBasePath(resolve('.gro/dev/buildName/foo/bar/baz.js')), 'foo/bar/baz.js');
});

test('hasSourceExtension()', () => {
	test('typescript', () => {
		t.ok(hasSourceExtension('foo/bar/baz.ts'));
	});
	test('svelte', () => {
		t.ok(hasSourceExtension('foo/bar/baz.svelte'));
	});
});

test('toImportId()', () => {
	t.is(toImportId(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	t.is(toImportId(resolve('src/foo/bar.ts'), false, 'baz'), resolve('.gro/prod/baz/foo/bar.js'));
	t.is(
		toImportId(resolve('src/foo/bar.svelte'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.svelte.js'),
	);
});

test('toBuildExtension()', () => {
	t.is(toBuildExtension('foo/bar.ts'), 'foo/bar.js');
	t.is(toBuildExtension('foo/bar.svelte'), 'foo/bar.svelte.js');
	t.is(toBuildExtension('foo/bar.css'), 'foo/bar.css');
	t.is(toBuildExtension('foo/bar.png'), 'foo/bar.png');
});

test('toSourceExtension()', () => {
	t.is(toSourceExtension('foo/bar.js'), 'foo/bar.ts');
	t.is(toSourceExtension('foo/bar.js.map'), 'foo/bar.ts');
	t.is(toSourceExtension('foo/bar.svelte.js'), 'foo/bar.svelte');
	t.is(toSourceExtension('foo/bar.svelte.js.map'), 'foo/bar.svelte');
	t.is(toSourceExtension('foo/bar.svelte.css'), 'foo/bar.svelte');
	t.is(toSourceExtension('foo/bar.svelte.css.map'), 'foo/bar.svelte');
	t.is(toSourceExtension('foo/bar.css'), 'foo/bar.css');
	t.is(toSourceExtension('foo/bar.css.map'), 'foo/bar.css');
	t.is(toSourceExtension('foo/bar.png'), 'foo/bar.png');
	t.is(toSourceExtension('foo/bar.png.map'), 'foo/bar.png');
	t.is(toSourceExtension('foo/bar/'), 'foo/bar/');
	t.is(toSourceExtension('foo/bar'), 'foo/bar');
	t.is(toSourceExtension('foo/'), 'foo/');
	t.is(toSourceExtension('foo'), 'foo');
});

test('EXTERNALS_BUILD_DIR has no slash', () => {
	t.ok(!EXTERNALS_BUILD_DIR.includes('/'));
});
