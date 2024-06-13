import {join, extname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import {gray} from 'kleur/colors';
import type {Flavored} from '@ryanatkn/belt/types.js';
import {z} from 'zod';

/*

A path `id` is an absolute path to the source/.gro/dist directory.
It's the same name that Rollup uses.

*/

// TODO pass these to `create_paths` and override from gro config
// TODO this is kinda gross - do we want to maintain the convention to have the trailing slash in most usage?
export const SOURCE_DIRNAME = 'src';
export const GRO_DIRNAME = '.gro';
export const GRO_DIST_PREFIX = 'dist_'; //
export const SERVER_DIST_PATH = 'dist_server'; // TODO should all of these be `_PATH` or should this be `DIRNAME`?
export const LIB_DIRNAME = 'lib'; // TODO use Svelte config `files.lib`
export const ROUTES_DIRNAME = 'routes'; // TODO use Svelte config `files.lib`
export const GRO_DEV_DIRNAME = GRO_DIRNAME + '/dev';
export const SOURCE_DIR = SOURCE_DIRNAME + '/';
export const GRO_DIR = GRO_DIRNAME + '/';
export const GRO_DEV_DIR = GRO_DEV_DIRNAME + '/';
export const LIB_PATH = SOURCE_DIR + LIB_DIRNAME;
export const LIB_DIR = LIB_PATH + '/'; // TODO @multiple get from the sveltekit config

export const CONFIG_PATH = 'gro.config.ts';

export const README_FILENAME = 'README.md';
export const SVELTEKIT_CONFIG_FILENAME = 'svelte.config.js';
export const VITE_CONFIG_FILENAME = 'vite.config.ts';
export const SVELTEKIT_DEV_DIRNAME = '.svelte-kit'; // TODO use Svelte config value `outDir`
export const SVELTEKIT_BUILD_DIRNAME = 'build';
export const SVELTEKIT_DIST_DIRNAME = 'dist';
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
	build_dev: string;
	config: string;
}

// TODO upstream to util, and probably add `Path`/`FilePath` and `FileUrl`
export const Url = z.string();
export type Url = Flavored<z.infer<typeof Url>, 'Url'>;

export const Email = z.string();
export type Email = Flavored<z.infer<typeof Email>, 'Email'>;

export const Source_Id = z.string();
export type Source_Id = Flavored<z.infer<typeof Source_Id>, 'Source_Id'>;

export const Build_Id = z.string();
export type Build_Id = Flavored<z.infer<typeof Build_Id>, 'Build_Id'>;

export const create_paths = (root_dir: string): Paths => {
	// TODO remove reliance on trailing slash towards windows support
	const root = strip_end(root_dir, '/') + '/';
	return {
		root,
		source: root + SOURCE_DIR,
		lib: root + LIB_DIR, // TODO @multiple get from the sveltekit config
		build: root + GRO_DIR,
		build_dev: root + GRO_DEV_DIR,
		config: root + CONFIG_PATH,
	};
};

export const paths_from_id = (id: string): Paths => (is_gro_id(id) ? gro_paths : paths);
export const is_gro_id = (id: string): boolean => id.startsWith(gro_paths.root);

// TODO maybe infer `p` for the functions that take in ids using `paths_from_id`?

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const to_root_path = (id: string, p = paths): string => strip_start(id, p.root);

// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const source_id_to_base_path = (source_id: Source_Id, p = paths): string =>
	relative(p.source, source_id);

// TODO base_path is an obsolete concept, it was a remnant from forcing `src/`
// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const base_path_to_source_id = (base_path: string, p = paths): Source_Id =>
	join(p.source, base_path);

// An `import_id` can be a source_id in a project,
// or a Gro source_id when running inside Gro,
// or a `gro/dist/` file id in node_modules when inside another project.
export const import_id_to_lib_path = (import_id: string, p = paths_from_id(import_id)): string => {
	if (p.root === gro_paths.root) {
		const stripped = strip_start(strip_start(import_id, p.lib), GRO_SVELTEKIT_DIST_DIR); // TODO hacky, needs more work to clarify related things
		const lib_path = IS_THIS_GRO ? stripped : replace_extension(stripped, '.ts');
		return lib_path;
	} else {
		return strip_start(import_id, p.lib);
	}
};

export const to_gro_input_path = (input_path: string): string => {
	const base_path = input_path === paths.lib.slice(0, -1) ? '' : strip_start(input_path, paths.lib);
	return GRO_SVELTEKIT_DIST_DIR + base_path;
};

// Can be used to map a source id from e.g. the cwd to gro's.
export const replace_root_dir = (id: string, root_dir: string, p = paths): string =>
	join(root_dir, to_root_path(id, p));

export const print_path = (path: string, p = paths, prefix = './'): string => {
	const root_path = path === GRO_SVELTEKIT_DIST_DIR ? 'gro' : to_root_path(path, p);
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

export const GRO_PACKAGE_DIR = 'gro/';
// TODO document these conditions with comments
// TODO there's probably a more robust way to do this
const filename = fileURLToPath(import.meta.url);
const gro_package_dir_path = join(
	filename,
	filename.includes('/gro/src/lib/')
		? '../../../'
		: filename.includes('/gro/dist/')
			? '../../'
			: '../',
);
export const paths = create_paths(process.cwd() + '/');
export const IS_THIS_GRO = gro_package_dir_path === paths.root;
export const gro_paths = IS_THIS_GRO ? paths : create_paths(gro_package_dir_path);
export const GRO_SVELTEKIT_DIST_DIR = gro_paths.root + SVELTEKIT_DIST_DIRNAME + '/';
