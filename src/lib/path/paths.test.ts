import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join, sep} from 'node:path';

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
	buildIdToSourceId,
} from './paths.js';

/* test__createPaths */
const test__createPaths = suite('createPaths');

test__createPaths('basic behavior', () => {
	const root = resolve('../fake');
	const p = createPaths(root);
	assert.is(p.root, join(root, sep));
	assert.is(p.source, join(root, 'src/'));
});

test__createPaths('paths object has the same identity as the groPaths object', () => {
	assert.is(paths, groPaths); // because we're testing inside the Gro project
});

test__createPaths.run();
/* test__createPaths */

/* test__isGroId */
const test__isGroId = suite('isGroId');

test__isGroId('basic behavior', () => {
	assert.ok(isGroId(resolve(paths.source)));
	assert.ok(!isGroId(resolve('../fake/src')));
});

test__isGroId.run();
/* test__isGroId */

/* test__toRootPath */
const test__toRootPath = suite('toRootPath');

test__toRootPath('basic behavior', () => {
	assert.is(toRootPath(resolve('foo/bar')), 'foo/bar');
});

test__toRootPath.run();
/* test__toRootPath */

/* test__sourceIdToBasePath */
const test__sourceIdToBasePath = suite('sourceIdToBasePath');

test__sourceIdToBasePath('basic behavior', () => {
	assert.is(sourceIdToBasePath(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

test__sourceIdToBasePath.run();
/* test__sourceIdToBasePath */

/* test__buildIdToSourceId */
const test__buildIdToSourceId = suite('buildIdToSourceId');

test__buildIdToSourceId('basic behavior', () => {
	assert.is(buildIdToSourceId(resolve('.gro/dev/somebuild/foo/bar.js')), resolve('src/foo/bar.ts'));
});

test__buildIdToSourceId.run();
/* test__buildIdToSourceId */

/* test__basePathToSourceId */
const test__basePathToSourceId = suite('basePathToSourceId');

test__basePathToSourceId('basic behavior', () => {
	assert.is(basePathToSourceId('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

test__basePathToSourceId('does not change extension', () => {
	assert.is(basePathToSourceId('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

test__basePathToSourceId.run();
/* test__basePathToSourceId */

// TODO !
// toBuildOutDir
// toBuildOutPath

/* test__toBuildBasePath */
const test__toBuildBasePath = suite('toBuildBasePath');

test__toBuildBasePath('basic behavior', () => {
	assert.is(toBuildBasePath(resolve('.gro/dev/buildName/foo/bar/baz.js')), 'foo/bar/baz.js');
});

test__toBuildBasePath.run();
/* test__toBuildBasePath */

/* test__hasSourceExtension */
const test__hasSourceExtension = suite('hasSourceExtension');

test__hasSourceExtension('typescript', () => {
	assert.ok(hasSourceExtension('foo/bar/baz.ts'));
});

test__hasSourceExtension('json', () => {
	assert.ok(hasSourceExtension('foo/bar/baz.json'));
});

test__hasSourceExtension.run();
/* test__hasSourceExtension */

/* test__toBuildExtension */
const test__toBuildExtension = suite('toBuildExtension');

test__toBuildExtension('basic behavior', () => {
	assert.is(toBuildExtension('foo/bar.ts'), 'foo/bar.js');
	assert.is(toBuildExtension('foo/bar.json'), 'foo/bar.json.js');
	assert.is(toBuildExtension('foo/bar.css'), 'foo/bar.css');
	assert.is(toBuildExtension('foo/bar.png'), 'foo/bar.png');
});

test__toBuildExtension.run();
/* test__toBuildExtension */

/* test__toSourceExtension */
const test__toSourceExtension = suite('toSourceExtension');

test__toSourceExtension('basic behavior', () => {
	assert.is(toSourceExtension('foo/bar.js'), 'foo/bar.ts');
	assert.is(toSourceExtension('foo/bar.js.map'), 'foo/bar.ts');
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

test__toSourceExtension.run();
/* test__toSourceExtension */

/* test__toImportId */
const test__toImportId = suite('toImportId');

test__toImportId('basic behavior', () => {
	assert.is(toImportId(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	assert.is(
		toImportId(resolve('src/foo/bar.ts'), false, 'baz'),
		resolve('.gro/prod/baz/foo/bar.js'),
	);
	assert.is(
		toImportId(resolve('src/foo/bar.json'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.json.js'),
	);
});

test__toImportId.run();
/* test__toImportId */