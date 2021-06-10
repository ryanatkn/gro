import {join, basename} from 'path';
import {fileURLToPath} from 'url';
import {replace_extension, strip_trailing_slash} from '@feltcoop/felt/util/path.js';
import {strip_start} from '@feltcoop/felt/util/string.js';
import {gray} from '@feltcoop/felt/util/terminal.js';

import type {Build_Name} from './build/build_config.js';

/*

A path `id` is an absolute path to the source/.gro/dist directory.
It's the same nomenclature that Rollup uses.

A `base_path` is the format used by `CheapWatch`.
It's a bare relative path without a source or .gro directory,
e.g. 'foo/bar.ts'.

`CheapWatch` also uses an array of `pathParts`.
For path './foo/bar/baz.ts',
the `pathParts` are `['foo', 'foo/bar', 'foo/bar/baz.ts']`.

*/

// TODO pass these to `create_paths` and override from gro config
// TODO this is kinda gross - do we want to maintain the convention to have the trailing slash in most usage?
export const SOURCE_DIRNAME = 'src';
export const BUILD_DIRNAME = '.gro';
export const DIST_DIRNAME = 'dist';
export const SOURCE_DIR = `${SOURCE_DIRNAME}/`;
export const BUILD_DIR = `${BUILD_DIRNAME}/`;
export const DIST_DIR = `${DIST_DIRNAME}/`;

export const CONFIG_SOURCE_PATH = 'gro.config.ts';
export const CONFIG_BUILD_PATH = 'gro.config.js';

export const EXTERNALS_BUILD_DIRNAME = 'externals'; // TODO breaks the above trailing slash convention - revisit with trailing-slash branch
export const EXTERNALS_BUILD_DIR_ROOT_PREFIX = `/${EXTERNALS_BUILD_DIRNAME}/`;

export const JS_EXTENSION = '.js';
export const TS_EXTENSION = '.ts';
export const TS_TYPE_EXTENSION = '.d.ts';
export const TS_TYPEMAP_EXTENSION = '.d.ts.map'; // `declarationMap` -> `typemap` to match `sourcemap`
export const CSS_EXTENSION = '.css';
export const SVELTE_EXTENSION = '.svelte';
export const SVELTE_JS_BUILD_EXTENSION = '.svelte.js';
export const SVELTE_CSS_BUILD_EXTENSION = '.svelte.css';
export const JSON_EXTENSION = '.json';
export const SOURCEMAP_EXTENSION = '.map';
export const JS_SOURCEMAP_EXTENSION = '.js.map';
export const SVELTE_JS_SOURCEMAP_EXTENSION = '.svelte.js.map';
export const SVELTE_CSS_SOURCEMAP_EXTENSION = '.svelte.css.map';

export const README_FILENAME = 'README.md';
export const SVELTEKIT_CONFIG_FILENAME = 'svelte.config.cjs';
export const SVELTEKIT_DEV_DIRNAME = '.svelte-kit';
export const SVELTEKIT_BUILD_DIRNAME = 'build';
export const SVELTEKIT_DIST_DIRNAME = 'svelte-kit'; // TODO maybe make SvelteKit frontend a proper build config, and delete this line
export const SVELTEKIT_APP_DIRNAME = 'app'; // same as /svelte.config.cjs `kit.appDir`
export const SVELTEKIT_VITE_CACHE_PATH = 'node_modules/.vite';
export const NODE_MODULES_DIRNAME = 'node_modules';
export const GITHUB_DIRNAME = '.github';
export const GIT_DIRNAME = '.git';
export const GITIGNORE_FILENAME = '.gitignore';
export const TSCONFIG_FILENAME = 'tsconfig.json';

export interface Paths {
	root: string;
	source: string;
	build: string;
	dist: string;
	config_source_id: string;
}

export const create_paths = (root: string): Paths => {
	root = strip_trailing_slash(root) + '/';
	const source = `${root}${SOURCE_DIR}`;
	const build = `${root}${BUILD_DIR}`;
	return {
		root,
		source,
		build,
		dist: `${root}${DIST_DIR}`,
		config_source_id: `${source}${CONFIG_SOURCE_PATH}`,
	};
};

export const paths_from_id = (id: string): Paths => (is_gro_id(id) ? gro_paths : paths);
export const is_gro_id = (id: string): boolean => id.startsWith(gro_paths.root);

export const is_source_id = (id: string, p = paths): boolean => id.startsWith(p.source);

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const to_root_path = (id: string, p = paths): string => strip_start(id, p.root);

// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const source_id_to_base_path = (source_id: string, p = paths): string =>
	strip_start(source_id, p.source);

// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const base_path_to_source_id = (base_path: string, p = paths): string =>
	`${p.source}${base_path}`;

export const to_build_out_dir = (dev: boolean, build_dir = paths.build): string =>
	`${strip_trailing_slash(build_dir)}/${to_build_out_dirname(dev)}`;
export const to_build_out_dirname = (dev: boolean): Build_Out_Dirname =>
	dev ? BUILD_DIRNAME_DEV : BUILD_DIRNAME_PROD;
export const BUILD_DIRNAME_DEV = 'dev';
export const BUILD_DIRNAME_PROD = 'prod';
export type Build_Out_Dirname = 'dev' | 'prod';

export const TYPES_BUILD_DIRNAME = 'types';
export const to_types_build_dir = (p = paths) => `${p.build}${TYPES_BUILD_DIRNAME}`;

export const to_build_out_path = (
	dev: boolean,
	build_name: Build_Name,
	base_path = '',
	build_dir = paths.build,
): string => `${to_build_out_dir(dev, build_dir)}/${build_name}/${base_path}`;

export const to_build_base_path = (build_id: string, build_dir = paths.build): string => {
	const rootPath = strip_start(build_id, build_dir);
	let separatorCount = 0;
	for (let i = 0; i < rootPath.length; i++) {
		if (rootPath[i] === '/') separatorCount++;
		if (separatorCount === 2) {
			// `2` to strip the dev/prod directory and the build name directory
			return rootPath.substring(i + 1);
		}
	}
	// TODO ? errors on inputs like `terser` - should that be allowed to be a `build_id`??
	// can reproduce by removing a dependency (when turned off I think?)
	// throw Error(`Invalid build id, cannot convert to build base path: ${build_id}`);
	return build_id;
};

// TODO probably change this to use a regexp (benchmark?)
export const has_source_extension = (path: string): boolean =>
	(path.endsWith(TS_EXTENSION) && !path.endsWith(TS_TYPE_EXTENSION)) ||
	path.endsWith(SVELTE_EXTENSION);

// Can be used to map a source id from e.g. the cwd to gro's.
export const replace_root_dir = (id: string, root_dir: string, p = paths): string =>
	join(root_dir, to_root_path(id, p));

// Converts a source id into an id that can be imported.
// When importing from inside Gro's dist/ directory,
// it returns a relative path and ignores `dev` and `build_name`.
export const to_import_id = (
	source_id: string,
	dev: boolean,
	build_name: Build_Name,
	p = paths_from_id(source_id),
): string => {
	const dir_base_path = strip_start(to_build_extension(source_id), p.source);
	return !is_this_project_gro && gro_import_dir === p.dist
		? join(gro_import_dir, dir_base_path)
		: to_build_out_path(dev, build_name, dir_base_path, p.build);
};

// TODO This function loses information. It's also hardcodedd to Gro's default file types.
// Maybe this points to a configurable system? Users can define their own extensions in Gro.
// Maybe `extensionConfigs: FilerExtensionConfig[]`.
export const to_build_extension = (source_id: string): string =>
	source_id.endsWith(TS_EXTENSION)
		? replace_extension(source_id, JS_EXTENSION)
		: source_id.endsWith(SVELTE_EXTENSION)
		? source_id + JS_EXTENSION
		: source_id;

// This implementation is complicated but it's fast.
// TODO see `to_build_extension` comments for discussion about making this generic and configurable
export const to_source_extension = (build_id: string): string => {
	let len = build_id.length;
	let i = len;
	let extension_count = 1;
	let char: string | undefined;
	let extension1: string | null = null;
	let extension2: string | null = null;
	let extension3: string | null = null;
	while (true) {
		i--;
		if (i < 0) break;
		char = build_id[i];
		if (char === '/') break;
		if (char === '.') {
			const current_extension = build_id.substring(i);
			if (extension_count === 1) {
				extension1 = current_extension;
				extension_count = 2;
			} else if (extension_count === 2) {
				extension2 = current_extension;
				extension_count = 3;
			} else if (extension_count === 3) {
				extension3 = current_extension;
				extension_count = 4;
			} else {
				// don't handle any more extensions
				break;
			}
		}
	}
	switch (extension3) {
		case SVELTE_JS_SOURCEMAP_EXTENSION:
		case SVELTE_CSS_SOURCEMAP_EXTENSION: {
			return build_id.substring(0, len - extension2!.length);
		}
		// case undefined:
		// default:
		// 	return build_id;
		// 	break;
	}
	switch (extension2) {
		case SVELTE_JS_BUILD_EXTENSION:
		case SVELTE_CSS_BUILD_EXTENSION: {
			return build_id.substring(0, len - extension1!.length);
		}
		case JS_SOURCEMAP_EXTENSION: {
			return build_id.substring(0, len - extension2.length) + TS_EXTENSION;
		}
		// case undefined:
		// default:
		// 	return build_id;
		// 	break;
	}
	switch (extension1) {
		case SOURCEMAP_EXTENSION: {
			return build_id.substring(0, len - extension1.length);
		}
		case JS_EXTENSION: {
			return build_id.substring(0, len - extension1.length) + TS_EXTENSION;
		}
		// case undefined:
		// default:
		// 	return build_id;
		// 	break;
	}
	return build_id;
};

export const gro_import_dir = join(fileURLToPath(import.meta.url), '../');
export const gro_dir = join(
	gro_import_dir,
	join(gro_import_dir, '../../').endsWith(BUILD_DIR) ? '../../../' : '../', // yikes lol
);
export const gro_dir_basename = `${basename(gro_dir)}/`;
export const paths = create_paths(`${process.cwd()}/`);
export const is_this_project_gro = gro_dir === paths.root;
export const gro_paths = is_this_project_gro ? paths : create_paths(gro_dir);

export const print_path = (path: string, p = paths, prefix = './'): string =>
	gray(`${prefix}${to_root_path(path, p)}`);

export const print_path_or_gro_path = (path: string, from_paths = paths): string => {
	const inferred_paths = paths_from_id(path);
	if (from_paths === gro_paths || inferred_paths === from_paths) {
		return print_path(path, inferred_paths, '');
	} else {
		return gray(gro_dir_basename) + print_path(path, gro_paths, '');
	}
};
