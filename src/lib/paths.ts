import {join, extname, relative, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import {gray} from 'kleur/colors';

import {
	GRO_CONFIG_PATH,
	GRO_DEV_DIR,
	GRO_DIR,
	SOURCE_DIR,
	SVELTEKIT_DIST_DIRNAME,
} from './path_constants.js';
import {sveltekit_config_global} from './sveltekit_config_global.js';
import type {Path_Id} from './path.js';

/*

A path `id` is an absolute path to the source/.gro/dist directory.
It's the same name that Rollup uses.

*/

export const LIB_DIRNAME = basename(sveltekit_config_global.lib_path);
export const LIB_PATH = SOURCE_DIR + LIB_DIRNAME;
export const LIB_DIR = LIB_PATH + '/';
export const ROUTES_DIRNAME = basename(sveltekit_config_global.routes_path);

export interface Paths {
	root: string;
	source: string;
	lib: string;
	build: string;
	build_dev: string;
	config: string;
}

export const create_paths = (root_dir: string): Paths => {
	// TODO remove reliance on trailing slash towards windows support
	const root = strip_end(root_dir, '/') + '/';
	return {
		root,
		source: root + SOURCE_DIR,
		lib: root + LIB_DIR,
		build: root + GRO_DIR,
		build_dev: root + GRO_DEV_DIR,
		config: root + GRO_CONFIG_PATH,
	};
};

export const infer_paths = (id: Path_Id): Paths => (is_gro_id(id) ? gro_paths : paths);
export const is_gro_id = (id: Path_Id): boolean => id.startsWith(strip_end(gro_paths.root, '/')); // strip `/` in case we're looking at the Gro root without a trailing slash

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const to_root_path = (id: Path_Id, p = infer_paths(id)): string => strip_start(id, p.root);

// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const path_id_to_base_path = (path_id: Path_Id, p = infer_paths(path_id)): string =>
	relative(p.source, path_id);

// TODO base_path is an obsolete concept, it was a remnant from forcing `src/`
// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const base_path_to_path_id = (base_path: string, p = infer_paths(base_path)): Path_Id =>
	join(p.source, base_path);

export const print_path = (path: string, p = infer_paths(path), prefix = './'): string => {
	const root_path = path === GRO_DIST_DIR ? 'gro' : to_root_path(path, p);
	return gray(`${prefix}${root_path}`);
};

export const replace_extension = (path: string, new_extension: string): string => {
	const {length} = extname(path);
	return (length === 0 ? path : path.substring(0, path.length - length)) + new_extension;
};

/**
 * Paths for the user repo.
 */
export const paths = create_paths(process.cwd());

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
export const IS_THIS_GRO = gro_package_dir_path === paths.root;
/**
 * Paths for the Gro package being used by the user repo.
 */
export const gro_paths = IS_THIS_GRO ? paths : create_paths(gro_package_dir_path);
export const GRO_DIST_DIR = gro_paths.root + SVELTEKIT_DIST_DIRNAME + '/';
