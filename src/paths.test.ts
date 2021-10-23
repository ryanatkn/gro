import {suite} from 'uvu';
import * as assert from 'uvu/assert';
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
	EXTERNALS_BUILD_DIRNAME,
	buildIdToSourceId,
} from './paths.js';

/* testCreatePaths */
const testCreatePaths = suite('createPaths');

testCreatePaths('basic behavior', () => {
	const root = resolve('../fake');
	const p = createPaths(root);
	assert.is(p.root, join(root, sep));
	assert.is(p.source, join(root, 'src/'));
});

testCreatePaths('paths object has the same identity as the groPaths object', () => {
	assert.is(paths, groPaths); // because we're testing inside the Gro project
});

testCreatePaths.run();
/* /testCreatePaths */

/* testIsGroId */
const testIsGroId = suite('isGroId');

testIsGroId('basic behavior', () => {
	assert.ok(isGroId(resolve(paths.source)));
	assert.not.ok(isGroId(resolve('../fake/src')));
});

testIsGroId.run();
/* /testIsGroId */

/* testToRootPath */
const testToRootPath = suite('toRootPath');

testToRootPath('basic behavior', () => {
	assert.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

testToRootPath.run();
/* /testToRootPath */

/* testSourceIdToBasePath */
const testSourceIdToBasePath = suite('sourceIdToBasePath');

testSourceIdToBasePath('basic behavior', () => {
	assert.is(sourceIdToBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

testSourceIdToBasePath.run();
/* /testSourceIdToBasePath */

/* testBuildIdToSourceId */
const testBuildIdToSourceId = suite('buildIdToSourceId');

testBuildIdToSourceId('basic behavior', () => {
	assert.is(buildIdToSourceId(resolve('.gro/dev/somebuild/foo/bar.js')), resolve('src/foo/bar.ts'));
});

testBuildIdToSourceId.run();
/* /testBuildIdToSourceId */

/* testBasePathToSourceId */
const testBasePathToSourceId = suite('basePathToSourceId');

testBasePathToSourceId('basic behavior', () => {
	assert.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

testBasePathToSourceId('does not change extension', () => {
	assert.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

testBasePathToSourceId.run();
/* /testBasePathToSourceId */

// TODO !
// toBuildOutDir
// toBuildOutPath

/* testToBuildBasePath */
const testToBuildBasePath = suite('toBuildBasePath');

testToBuildBasePath('basic behavior', () => {
	assert.is(toBuildBasePath(resolve('.gro/dev/buildName/foo/bar/baz.js')), 'foo/bar/baz.js');
});

testToBuildBasePath.run();
/* /testToBuildBasePath */

/* testHasSourceExtension */
const testHasSourceExtension = suite('hasSourceExtension');

testHasSourceExtension('typescript', () => {
	assert.ok(hasSourceExtension('foo/bar/baz.ts'));
});

testHasSourceExtension('svelte', () => {
	assert.ok(hasSourceExtension('foo/bar/baz.svelte'));
});

testHasSourceExtension('json', () => {
	assert.ok(hasSourceExtension('foo/bar/baz.json'));
});

testHasSourceExtension.run();
/* /testHasSourceExtension */

/* testToBuildExtension */
const testToBuildExtension = suite('toBuildExtension');

testToBuildExtension('basic behavior', () => {
	assert.is(toBuildExtension('foo/bar.ts', true), 'foo/bar.js');
	assert.is(toBuildExtension('foo/bar.ts', false), 'foo/bar.js');
	assert.is(toBuildExtension('foo/bar.svelte', true), 'foo/bar.svelte.js');
	assert.is(toBuildExtension('foo/bar.svelte', false), 'foo/bar.svelte');
	assert.is(toBuildExtension('foo/bar.json', true), 'foo/bar.json.js');
	assert.is(toBuildExtension('foo/bar.json', false), 'foo/bar.json.js');
	assert.is(toBuildExtension('foo/bar.css', true), 'foo/bar.css');
	assert.is(toBuildExtension('foo/bar.css', false), 'foo/bar.css');
	assert.is(toBuildExtension('foo/bar.png', true), 'foo/bar.png');
	assert.is(toBuildExtension('foo/bar.png', false), 'foo/bar.png');
});

testToBuildExtension.run();
/* /testToBuildExtension */

/* testToSourceExtension */
const testToSourceExtension = suite('toSourceExtension');

testToSourceExtension('basic behavior', () => {
	assert.is(toSourceExtension('foo/bar.js'), 'foo/bar.ts');
	assert.is(toSourceExtension('foo/bar.js.map'), 'foo/bar.ts');
	assert.is(toSourceExtension('foo/bar.d.ts'), 'foo/bar.ts');
	assert.is(toSourceExtension('foo/bar.d.ts.map'), 'foo/bar.ts');
	assert.is(toSourceExtension('foo/bar.svelte.js'), 'foo/bar.svelte');
	assert.is(toSourceExtension('foo/bar.svelte.js.map'), 'foo/bar.svelte');
	assert.is(toSourceExtension('foo/bar.svelte.css'), 'foo/bar.svelte');
	assert.is(toSourceExtension('foo/bar.svelte.css.map'), 'foo/bar.svelte');
	assert.is(toSourceExtension('foo/bar.json.js'), 'foo/bar.json');
	assert.is(toSourceExtension('foo/bar.css'), 'foo/bar.css');
	assert.is(toSourceExtension('foo/bar.css.map'), 'foo/bar.css');
	assert.is(toSourceExtension('foo/bar.png'), 'foo/bar.png');
	assert.is(toSourceExtension('foo/bar.png.map'), 'foo/bar.png');
	assert.is(toSourceExtension('foo/bar/'), 'foo/bar/');
	assert.is(toSourceExtension('foo/bar'), 'foo/bar');
	assert.is(toSourceExtension('foo/'), 'foo/');
	assert.is(toSourceExtension('foo'), 'foo');
});

testToSourceExtension.run();
/* /testToSourceExtension */

/* testToImportId */
const testToImportId = suite('toImportId');

testToImportId('basic behavior', () => {
	assert.is(toImportId(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	assert.is(
		toImportId(resolve('src/foo/bar.ts'), false, 'baz'),
		resolve('.gro/prod/baz/foo/bar.js'),
	);
	assert.is(
		toImportId(resolve('src/foo/bar.svelte'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.svelte.js'),
	);
	assert.is(
		toImportId(resolve('src/foo/bar.json'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.json.js'),
	);
});

testToImportId.run();
/* /testToImportId */

/* test_EXTERNALS_BUILD_DIRNAME */
const test_EXTERNALS_BUILD_DIRNAME = suite('EXTERNALS_BUILD_DIRNAME');

test_EXTERNALS_BUILD_DIRNAME('has no slash', () => {
	assert.not.ok(EXTERNALS_BUILD_DIRNAME.includes('/'));
});

test_EXTERNALS_BUILD_DIRNAME.run();
/* /test_EXTERNALS_BUILD_DIRNAME */
