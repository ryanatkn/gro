import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join, sep} from 'path';

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

/* test_createPaths */
const test_createPaths = suite('createPaths');

test_createPaths('basic behavior', () => {
	const root = resolve('../fake');
	const p = createPaths(root);
	t.is(p.root, join(root, sep));
	t.is(p.source, join(root, 'src/'));
});

test_createPaths('paths object has the same identity as the groPaths object', () => {
	t.is(paths, groPaths); // because we're testing inside the Gro project
});

test_createPaths.run();
/* /test_createPaths */

/* test_isGroId */
const test_isGroId = suite('isGroId');

test_isGroId('basic behavior', () => {
	t.ok(isGroId(resolve(paths.source)));
	t.not.ok(isGroId(resolve('../fake/src')));
});

test_isGroId.run();
/* /test_isGroId */

/* test_toRootPath */
const test_toRootPath = suite('toRootPath');

test_toRootPath('basic behavior', () => {
	t.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

test_toRootPath.run();
/* /test_toRootPath */

/* test_sourceIdToBasePath */
const test_sourceIdToBasePath = suite('sourceIdToBasePath');

test_sourceIdToBasePath('basic behavior', () => {
	t.is(sourceIdToBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

test_sourceIdToBasePath.run();
/* /test_sourceIdToBasePath */

/* test_basePathToSourceId */
const test_basePathToSourceId = suite('basePathToSourceId');

test_basePathToSourceId('basic behavior', () => {
	t.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

test_basePathToSourceId('does not change extension', () => {
	t.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

test_basePathToSourceId.run();
/* /test_basePathToSourceId */

// TODO !
// toBuildOutDir
// toBuildOutPath

/* test_toBuildBasePath */
const test_toBuildBasePath = suite('toBuildBasePath');

test_toBuildBasePath('basic behavior', () => {
	t.is(toBuildBasePath(resolve('.gro/dev/buildName/foo/bar/baz.js')), 'foo/bar/baz.js');
});

test_toBuildBasePath.run();
/* /test_toBuildBasePath */

/* test_hasSourceExtension */
const test_hasSourceExtension = suite('hasSourceExtension');

test_hasSourceExtension('typescript', () => {
	t.ok(hasSourceExtension('foo/bar/baz.ts'));
});

test_hasSourceExtension('svelte', () => {
	t.ok(hasSourceExtension('foo/bar/baz.svelte'));
});

test_hasSourceExtension.run();
/* /test_hasSourceExtension */

/* test_toImportId */
const test_toImportId = suite('toImportId');

test_toImportId('basic behavior', () => {
	t.is(toImportId(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	t.is(toImportId(resolve('src/foo/bar.ts'), false, 'baz'), resolve('.gro/prod/baz/foo/bar.js'));
	t.is(
		toImportId(resolve('src/foo/bar.svelte'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.svelte.js'),
	);
});

test_toImportId.run();
/* /test_toImportId */

/* test_toBuildExtension */
const test_toBuildExtension = suite('toBuildExtension');

test_toBuildExtension('basic behavior', () => {
	t.is(toBuildExtension('foo/bar.ts'), 'foo/bar.js');
	t.is(toBuildExtension('foo/bar.svelte'), 'foo/bar.svelte.js');
	t.is(toBuildExtension('foo/bar.css'), 'foo/bar.css');
	t.is(toBuildExtension('foo/bar.png'), 'foo/bar.png');
});

test_toBuildExtension.run();
/* /test_toBuildExtension */

/* test_toSourceExtension */
const test_toSourceExtension = suite('toSourceExtension');

test_toSourceExtension('basic behavior', () => {
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

test_toSourceExtension.run();
/* /test_toSourceExtension */

/* test_EXTERNALS_BUILD_DIR */
const test_EXTERNALS_BUILD_DIR = suite('EXTERNALS_BUILD_DIR');

test_EXTERNALS_BUILD_DIR('has no slash', () => {
	t.not.ok(EXTERNALS_BUILD_DIR.includes('/'));
});

test_EXTERNALS_BUILD_DIR.run();
/* /test_EXTERNALS_BUILD_DIR */
