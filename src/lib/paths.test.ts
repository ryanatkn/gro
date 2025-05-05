import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve, join} from 'node:path';

import {
	create_paths,
	paths,
	gro_paths,
	is_gro_id,
	to_root_path,
	path_id_to_base_path,
	base_path_to_path_id,
} from './paths.ts';

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

const test__is_gro_id = suite('is_gro_id');

test__is_gro_id('basic behavior', () => {
	assert.ok(is_gro_id(resolve(paths.root)));
	assert.ok(is_gro_id(resolve(paths.root.slice(0, -1))));
	assert.ok(is_gro_id(resolve(paths.source).slice(0, -1)));
	assert.ok(!is_gro_id(resolve('../fake/src')));
	assert.ok(!is_gro_id(resolve('../fake/src/')));
	assert.ok(!is_gro_id(resolve('../gro_fake')));
	assert.ok(!is_gro_id(resolve('../gro_fake/')));
	assert.ok(!is_gro_id(resolve('../gro_fake/src')));
	assert.ok(!is_gro_id(resolve('../gro_fake/src/')));
});

test__is_gro_id.run();

const test__to_root_path = suite('to_root_path');

test__to_root_path('basic behavior', () => {
	assert.is(to_root_path(resolve('foo/bar')), 'foo/bar');
	assert.is(to_root_path(resolve('./')), './');
	assert.is(to_root_path(resolve('./')), './');
});

test__to_root_path.run();

const test__path_id_to_base_path = suite('path_id_to_base_path');

test__path_id_to_base_path('basic behavior', () => {
	assert.is(path_id_to_base_path(resolve('src/foo/bar/baz.ts')), 'foo/bar/baz.ts');
});

test__path_id_to_base_path.run();

const test__base_path_to_path_id = suite('base_path_to_path_id');

test__base_path_to_path_id('basic behavior', () => {
	assert.is(base_path_to_path_id('foo/bar/baz.ts'), resolve('src/foo/bar/baz.ts'));
});

test__base_path_to_path_id('does not change extension', () => {
	assert.is(base_path_to_path_id('foo/bar/baz.js'), resolve('src/foo/bar/baz.js'));
});

test__base_path_to_path_id.run();
