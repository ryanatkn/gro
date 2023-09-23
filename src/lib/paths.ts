import {join, basename, extname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strip_end, strip_start} from '@grogarden/util/string.js';
import {gray} from 'kleur/colors';
import type {Flavored} from '@grogarden/util/types.js';

// TODO for Windows support we might need to change every `/` here to `sep`? https://github.com/grogarden/gro/issues/319

/*

A path `id` is an absolute path to the source/.gro/dist directory.
It's the same nomenclature that Rollup uses.

A `base_path` is the format used by `CheapWatch`.
It's a bare relative path without a source or .gro directory,
e.g. 'foo/bar.ts'.

`CheapWatch` also uses an array of `path_parts`.
For path './foo/bar/baz.ts',
the `path_parts` are `['foo', 'foo/bar', 'foo/bar/baz.ts']`.

*/

// TODO pass these to `create_paths` and override from gro config
// TODO this is kinda gross - do we want to maintain the convention to have the trailing slash in most usage?
export const SOURCE_DIRNAME = 'src';
export const BUILD_DIRNAME = '.gro';
export const SVELTEKIT_DIST_DIRNAME = 'dist';
export const LIB_DIRNAME = 'lib';
export const BUILD_DIST_DIRNAME = BUILD_DIRNAME + '/dist';
export const BUILD_DEV_DIRNAME = BUILD_DIRNAME + '/dev';
export const SOURCE_DIR = SOURCE_DIRNAME + '/';
export const BUILD_DIR = BUILD_DIRNAME + '/';
export const BUILD_DIST_DIR = BUILD_DIST_DIRNAME + '/';
export const BUILD_DEV_DIR = BUILD_DEV_DIRNAME + '/';
export const LIB_PATH = SOURCE_DIR + LIB_DIRNAME;
export const LIB_DIR = LIB_PATH + '/';

export const CONFIG_PATH = 'gro.config.ts';

export const README_FILENAME = 'README.md';
export const SVELTEKIT_CONFIG_FILENAME = 'svelte.config.js';
export const VITE_CONFIG_FILENAME = 'vite.config.ts';
export const SVELTEKIT_DEV_DIRNAME = '.svelte-kit';
export const SVELTEKIT_BUILD_DIRNAME = 'build';
export const NODE_MODULES_DIRNAME = 'node_modules';
export const SVELTEKIT_VITE_CACHE_PATH = NODE_MODULES_DIRNAME + '/.vite';
export const GITHUB_DIRNAME = '.github';
export const GIT_DIRNAME = '.git';
export const TSCONFIG_FILENAME = 'tsconfig.json';

export interface Paths {
	root: string;
	source: string;
	lib: string;
	build: string;
	build_dist: string;
	build_dev: string;
	config: string;
}

// TODO upstream to util, and probably add `Path`/`FilePath` and `FileUrl`
export type Url = Flavored<string, 'Url'>;
export type Email = Flavored<string, 'Email'>;
export type SourceId = Flavored<string, 'SourceId'>;
export type BuildId = Flavored<string, 'BuildId'>;

export const create_paths = (root_dir: string): Paths => {
	// TODO remove reliance on trailing slash towards windows support
	const root = strip_end(root_dir, '/') + '/';
	return {
		root,
		source: root + SOURCE_DIR,
		lib: root + LIB_DIR,
		build: root + BUILD_DIR,
		build_dist: root + BUILD_DIST_DIR,
		build_dev: root + BUILD_DEV_DIR,
		config: root + CONFIG_PATH,
	};
};

export const paths_from_id = (id: string): Paths => (is_gro_id(id) ? gro_paths : paths);
export const is_gro_id = (id: string): boolean => id.startsWith(gro_paths.root);

// TODO maybe infer `p` for the functions that take in ids using `paths_from_id`?

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const to_root_path = (id: string, p = paths): string => strip_start(id, p.root);

// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const source_id_to_base_path = (source_id: SourceId, p = paths): string =>
	relative(p.source, source_id);

// TODO base_path is an obsolete concept, it was a remnant from forcing `src/`
// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const base_path_to_source_id = (base_path: string, p = paths): SourceId =>
	join(p.source, base_path);

// To run Gro's tasks from its own project, we resolve from dist/ instead of src/.
// 'foo/bar/baz.ts' → '/home/me/app/src/lib/foo/bar/baz.ts'
// 'foo/bar/baz.ts' → '/home/me/app/dist/foo/bar/baz.ts'
export const lib_path_to_import_id = (base_path: string, p = paths): SourceId => {
	if (p.root === gro_paths.root) {
		return p.root + 'dist/' + base_path;
	} else {
		return base_path_to_source_id(LIB_DIRNAME + '/' + base_path, p);
	}
};

// An `import_id` can be a source_id in a project,
// or a Gro source_id when running inside Gro,
// or a `gro/dist/` file id in node_modules when inside another project.
export const import_id_to_lib_path = (import_id: string, p = paths_from_id(import_id)): string => {
	if (p.root === gro_paths.root) {
		const stripped = strip_start(strip_start(import_id, p.lib), gro_sveltekit_dist_dir); // TODO hacky, needs more work to clarify related things
		const lib_path = is_this_project_gro ? stripped : replace_extension(stripped, '.ts');
		return lib_path;
	} else {
		return strip_start(import_id, p.lib);
	}
};

export const to_gro_input_path = (input_path: string): string => {
	const base_path = input_path === paths.lib.slice(0, -1) ? '' : strip_start(input_path, paths.lib);
	return gro_sveltekit_dist_dir + base_path;
};

// Can be used to map a source id from e.g. the cwd to gro's.
export const replace_root_dir = (id: string, root_dir: string, p = paths): string =>
	join(root_dir, to_root_path(id, p));

export const print_path = (path: string, p = paths, prefix = './'): string => {
	const root_path = path === gro_sveltekit_dist_dir ? 'gro' : to_root_path(path, p);
	return gray(`${prefix}${root_path}`);
};

export const print_path_or_gro_path = (path: string, from_paths = paths): string => {
	const inferred_paths = paths_from_id(path);
	if (from_paths === gro_paths || inferred_paths === from_paths) {
		return print_path(path, inferred_paths, '');
	}
	return print_path(path, gro_paths, '');
};

export const replace_extension = (path: string, new_extension: string): string => {
	const {length} = extname(path);
	return (length === 0 ? path : path.substring(0, path.length - length)) + new_extension;
};

const filename = fileURLToPath(import.meta.url);
const gro_dir = join(
	filename,
	filename.includes('/gro/src/lib/')
		? '../../../'
		: filename.includes('/gro/dist/')
		? '../../'
		: '../',
);
export const gro_dir_basename = basename(gro_dir) + '/';
export const paths = create_paths(process.cwd() + '/');
export const is_this_project_gro = gro_dir === paths.root;
export const gro_paths = is_this_project_gro ? paths : create_paths(gro_dir);
export const gro_sveltekit_dist_dir = gro_paths.root + SVELTEKIT_DIST_DIRNAME + '/';
