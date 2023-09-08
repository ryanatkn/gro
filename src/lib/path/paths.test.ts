import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';

import {
	create_paths,
	paths,
	gro_paths,
	is_gro_id,
	to_root_path,
	source_id_to_base_path,
	base_path_to_source_id,
	to_build_extension,
	to_source_extension,
	to_build_base_path,
	build_id_to_source_id,
} from './paths.js';

/* test__create_paths */
const test__create_paths = suite('create_paths');

test__create_paths('basic behavior', () => {
	const root = resolve('../fake');
	const p = create_paths(root);
	assert.is(p.root, join(root, '/'));
	assert.is(p.source, join(root, 'src/'));
});

test__create_paths('paths object has the same identity as the gro_paths object', () => {
	assert.is(paths, gro_paths); // because we're testing inside the Gro project
});

test__create_paths.run();
/* test__create_paths */

/* test__is_gro_id */
const test__is_gro_id = suite('is_gro_id');

test__is_gro_id('basic behavior', () => {
	assert.ok(is_gro_id(resolve(paths.source)));
	assert.ok(!is_gro_id(resolve('../fake/src')));
});

test__is_gro_id.run();
/* test__is_gro_id */

/* test__to_root_path */
const test__to_root_path = suite('to_root_path');

test__to_root_path('basic behavior', () => {
	assert.is(to_root_path(resolve('foo/bar')), 'foo/bar');
});

test__to_root_path.run();
/* test__to_root_path */

/* test__source_id_to_base_path */
const test__source_id_to_base_path = suite('source_id_to_base_path');

test__source_id_to_base_path('basic behavior', () => {
	assert.is(source_id_to_base_path(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

test__source_id_to_base_path.run();
/* test__source_id_to_base_path */

/* test__build_id_to_source_id */
const test__build_id_to_source_id = suite('build_id_to_source_id');

test__build_id_to_source_id('basic behavior', () => {
	assert.is(
		build_id_to_source_id(resolve('.gro/dev/somebuild/foo/bar.js')),
		resolve('src/foo/bar.ts'),
	);
});

test__build_id_to_source_id.run();
/* test__build_id_to_source_id */

/* test__base_path_to_source_id */
const test__base_path_to_source_id = suite('base_path_to_source_id');

test__base_path_to_source_id('basic behavior', () => {
	assert.is(base_path_to_source_id('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

test__base_path_to_source_id('does not change extension', () => {
	assert.is(base_path_to_source_id('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

test__base_path_to_source_id.run();
/* test__base_path_to_source_id */

/* test__to_build_base_path */
const test__to_build_base_path = suite('to_build_base_path');

test__to_build_base_path('basic behavior', () => {
	assert.is(to_build_base_path(resolve('.gro/dev/build_name/foo/bar/baz.js')), 'foo/bar/baz.js');
});

test__to_build_base_path.run();
/* test__to_build_base_path */

/* test__to_build_extension */
const test__to_build_extension = suite('to_build_extension');

test__to_build_extension('basic behavior', () => {
	assert.is(to_build_extension('foo/bar.ts'), 'foo/bar.js');
	assert.is(to_build_extension('foo/bar.json'), 'foo/bar.json.js');
	assert.is(to_build_extension('foo/bar.css'), 'foo/bar.css');
	assert.is(to_build_extension('foo/bar.png'), 'foo/bar.png');
});

test__to_build_extension.run();
/* test__to_build_extension */

/* test__to_source_extension */
const test__to_source_extension = suite('to_source_extension');

test__to_source_extension('basic behavior', () => {
	assert.is(to_source_extension('foo/bar.js'), 'foo/bar.ts');
	assert.is(to_source_extension('foo/bar.js.map'), 'foo/bar.ts');
	assert.is(to_source_extension('foo/bar.json.js'), 'foo/bar.json');
	assert.is(to_source_extension('foo/bar.css'), 'foo/bar.css');
	assert.is(to_source_extension('foo/bar.css.map'), 'foo/bar.css');
	assert.is(to_source_extension('foo/bar.png'), 'foo/bar.png');
	assert.is(to_source_extension('foo/bar.png.map'), 'foo/bar.png');
	assert.is(to_source_extension('foo/bar/'), 'foo/bar/');
	assert.is(to_source_extension('foo/bar'), 'foo/bar');
	assert.is(to_source_extension('foo/'), 'foo/');
	assert.is(to_source_extension('foo'), 'foo');
});

test__to_source_extension.run();
/* test__to_source_extension */
