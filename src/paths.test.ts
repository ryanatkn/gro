import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve, join, sep} from 'path';

import {
	create_paths,
	paths,
	gro_paths,
	is_gro_id,
	to_root_path,
	source_id_to_base_path,
	base_path_to_source_id,
	has_source_extension,
	to_import_id,
	to_build_extension,
	to_source_extension,
	to_build_base_path,
	EXTERNALS_BUILD_DIRNAME,
	build_id_to_source_id,
} from './paths.js';

/* test_create_paths */
const test_create_paths = suite('create_paths');

test_create_paths('basic behavior', () => {
	const root = resolve('../fake');
	const p = create_paths(root);
	t.is(p.root, join(root, sep));
	t.is(p.source, join(root, 'src/'));
});

test_create_paths('paths object has the same identity as the gro_paths object', () => {
	t.is(paths, gro_paths); // because we're testing inside the Gro project
});

test_create_paths.run();
/* /test_create_paths */

/* test_is_gro_id */
const test_is_gro_id = suite('is_gro_id');

test_is_gro_id('basic behavior', () => {
	t.ok(is_gro_id(resolve(paths.source)));
	t.not.ok(is_gro_id(resolve('../fake/src')));
});

test_is_gro_id.run();
/* /test_is_gro_id */

/* test_to_root_path */
const test_to_root_path = suite('to_root_path');

test_to_root_path('basic behavior', () => {
	t.is(to_root_path(resolve('foo/bar')), 'foo/bar');
});

test_to_root_path.run();
/* /test_to_root_path */

/* test_source_id_to_base_path */
const test_source_id_to_base_path = suite('source_id_to_base_path');

test_source_id_to_base_path('basic behavior', () => {
	t.is(source_id_to_base_path(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

test_source_id_to_base_path.run();
/* /test_source_id_to_base_path */

/* test_build_id_to_source_id */
const test_build_id_to_source_id = suite('build_id_to_source_id');

test_build_id_to_source_id('basic behavior', () => {
	t.is(build_id_to_source_id(resolve('.gro/dev/somebuild/foo/bar.js')), resolve('src/foo/bar.ts'));
});

test_build_id_to_source_id.run();
/* /test_build_id_to_source_id */

/* test_base_path_to_source_id */
const test_base_path_to_source_id = suite('base_path_to_source_id');

test_base_path_to_source_id('basic behavior', () => {
	t.is(base_path_to_source_id('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

test_base_path_to_source_id('does not change extension', () => {
	t.is(base_path_to_source_id('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

test_base_path_to_source_id.run();
/* /test_base_path_to_source_id */

// TODO !
// to_build_out_dir
// to_build_out_path

/* test_to_build_base_path */
const test_to_build_base_path = suite('to_build_base_path');

test_to_build_base_path('basic behavior', () => {
	t.is(to_build_base_path(resolve('.gro/dev/build_name/foo/bar/baz.js')), 'foo/bar/baz.js');
});

test_to_build_base_path.run();
/* /test_to_build_base_path */

/* test_has_source_extension */
const test_has_source_extension = suite('has_source_extension');

test_has_source_extension('typescript', () => {
	t.ok(has_source_extension('foo/bar/baz.ts'));
});

test_has_source_extension('svelte', () => {
	t.ok(has_source_extension('foo/bar/baz.svelte'));
});

test_has_source_extension.run();
/* /test_has_source_extension */

/* test_to_import_id */
const test_to_import_id = suite('to_import_id');

test_to_import_id('basic behavior', () => {
	t.is(to_import_id(resolve('src/foo/bar.ts'), true, 'baz'), resolve('.gro/dev/baz/foo/bar.js'));
	t.is(to_import_id(resolve('src/foo/bar.ts'), false, 'baz'), resolve('.gro/prod/baz/foo/bar.js'));
	t.is(
		to_import_id(resolve('src/foo/bar.svelte'), true, 'baz'),
		resolve('.gro/dev/baz/foo/bar.svelte.js'),
	);
});

test_to_import_id.run();
/* /test_to_import_id */

/* test_to_build_extension */
const test_to_build_extension = suite('to_build_extension');

test_to_build_extension('basic behavior', () => {
	t.is(to_build_extension('foo/bar.ts', true), 'foo/bar.js');
	t.is(to_build_extension('foo/bar.svelte', true), 'foo/bar.svelte.js');
	t.is(to_build_extension('foo/bar.svelte', false), 'foo/bar.svelte');
	t.is(to_build_extension('foo/bar.css', true), 'foo/bar.css');
	t.is(to_build_extension('foo/bar.png', true), 'foo/bar.png');
});

test_to_build_extension.run();
/* /test_to_build_extension */

/* test_to_source_extension */
const test_to_source_extension = suite('to_source_extension');

test_to_source_extension('basic behavior', () => {
	t.is(to_source_extension('foo/bar.js'), 'foo/bar.ts');
	t.is(to_source_extension('foo/bar.js.map'), 'foo/bar.ts');
	t.is(to_source_extension('foo/bar.d.ts'), 'foo/bar.ts');
	t.is(to_source_extension('foo/bar.d.ts.map'), 'foo/bar.ts');
	t.is(to_source_extension('foo/bar.svelte.js'), 'foo/bar.svelte');
	t.is(to_source_extension('foo/bar.svelte.js.map'), 'foo/bar.svelte');
	t.is(to_source_extension('foo/bar.svelte.css'), 'foo/bar.svelte');
	t.is(to_source_extension('foo/bar.svelte.css.map'), 'foo/bar.svelte');
	t.is(to_source_extension('foo/bar.css'), 'foo/bar.css');
	t.is(to_source_extension('foo/bar.css.map'), 'foo/bar.css');
	t.is(to_source_extension('foo/bar.png'), 'foo/bar.png');
	t.is(to_source_extension('foo/bar.png.map'), 'foo/bar.png');
	t.is(to_source_extension('foo/bar/'), 'foo/bar/');
	t.is(to_source_extension('foo/bar'), 'foo/bar');
	t.is(to_source_extension('foo/'), 'foo/');
	t.is(to_source_extension('foo'), 'foo');
});

test_to_source_extension.run();
/* /test_to_source_extension */

/* test_EXTERNALS_BUILD_DIRNAME */
const test_EXTERNALS_BUILD_DIRNAME = suite('EXTERNALS_BUILD_DIRNAME');

test_EXTERNALS_BUILD_DIRNAME('has no slash', () => {
	t.not.ok(EXTERNALS_BUILD_DIRNAME.includes('/'));
});

test_EXTERNALS_BUILD_DIRNAME.run();
/* /test_EXTERNALS_BUILD_DIRNAME */
