import {join, basename} from 'path';
import {fileURLToPath} from 'url';
import {replaceExtension, stripTrailingSlash} from '@feltcoop/felt/utils/path.js';
import {stripStart} from '@feltcoop/felt/utils/string.js';
import {gray} from '@feltcoop/felt/utils/terminal.js';

import type {BuildName} from './build/buildConfig.js';

/*

A path `id` is an absolute path to the source/.gro/dist directory.
It's the same nomenclature that Rollup uses.

A `basePath` is the format used by `CheapWatch`.
It's a bare relative path without a source or .gro directory,
e.g. 'foo/bar.ts'.

`CheapWatch` also uses an array of `pathParts`.
For path './foo/bar/baz.ts',
the `pathParts` are `['foo', 'foo/bar', 'foo/bar/baz.ts']`.

*/

// TODO pass these to `createPaths` and override from gro config
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
export const SVELTE_KIT_CONFIG_FILENAME = 'svelte.config.cjs';
export const SVELTE_KIT_DEV_DIRNAME = '.svelte-kit';
export const SVELTE_KIT_BUILD_DIRNAME = 'build';
export const SVELTE_KIT_APP_DIRNAME = 'app'; // same as /svelte.config.cjs `kit.appDir`
export const SVELTE_KIT_VITE_CACHE_PATH = 'node_modules/.vite';
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
	configSourceId: string;
}

export const createPaths = (root: string): Paths => {
	root = stripTrailingSlash(root) + '/';
	const source = `${root}${SOURCE_DIR}`;
	const build = `${root}${BUILD_DIR}`;
	return {
		root,
		source,
		build,
		dist: `${root}${DIST_DIR}`,
		configSourceId: `${source}${CONFIG_SOURCE_PATH}`,
	};
};

export const pathsFromId = (id: string): Paths => (isGroId(id) ? groPaths : paths);
export const isGroId = (id: string): boolean => id.startsWith(groPaths.root);

export const isSourceId = (id: string, p = paths): boolean => id.startsWith(p.source);

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const toRootPath = (id: string, p = paths): string => stripStart(id, p.root);

// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const sourceIdToBasePath = (sourceId: string, p = paths): string =>
	stripStart(sourceId, p.source);

// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const basePathToSourceId = (basePath: string, p = paths): string => `${p.source}${basePath}`;

export const toBuildOutDir = (dev: boolean, buildDir = paths.build): string =>
	`${stripTrailingSlash(buildDir)}/${toBuildOutDirname(dev)}`;
export const toBuildOutDirname = (dev: boolean): BuildOutDirname =>
	dev ? BUILD_DIRNAME_DEV : BUILD_DIRNAME_PROD;
export const BUILD_DIRNAME_DEV = 'dev';
export const BUILD_DIRNAME_PROD = 'prod';
export type BuildOutDirname = 'dev' | 'prod';

export const TYPES_BUILD_DIRNAME = 'types';
export const toTypesBuildDir = (p = paths) => `${p.build}${TYPES_BUILD_DIRNAME}`;

export const toBuildOutPath = (
	dev: boolean,
	buildName: BuildName,
	basePath = '',
	buildDir = paths.build,
): string => `${toBuildOutDir(dev, buildDir)}/${buildName}/${basePath}`;

export const toBuildBasePath = (buildId: string, buildDir = paths.build): string => {
	const rootPath = stripStart(buildId, buildDir);
	let separatorCount = 0;
	for (let i = 0; i < rootPath.length; i++) {
		if (rootPath[i] === '/') separatorCount++;
		if (separatorCount === 2) {
			// `2` to strip the dev/prod directory and the build name directory
			return rootPath.substring(i + 1);
		}
	}
	// TODO ? errors on inputs like `terser` - should that be allowed to be a `buildId`??
	// can reproduce by removing a dependency (when turned off I think?)
	// throw Error(`Invalid build id, cannot convert to build base path: ${buildId}`);
	return buildId;
};

// TODO probably change this to use a regexp (benchmark?)
export const hasSourceExtension = (path: string): boolean =>
	(path.endsWith(TS_EXTENSION) && !path.endsWith(TS_TYPE_EXTENSION)) ||
	path.endsWith(SVELTE_EXTENSION);

// Can be used to map a source id from e.g. the cwd to gro's.
export const replaceRootDir = (id: string, rootDir: string, p = paths): string =>
	join(rootDir, toRootPath(id, p));

// Converts a source id into an id that can be imported.
// When importing from inside Gro's dist/ directory,
// it returns a relative path and ignores `dev` and `buildName`.
export const toImportId = (
	sourceId: string,
	dev: boolean,
	buildName: BuildName,
	p = pathsFromId(sourceId),
): string => {
	const dirBasePath = stripStart(toBuildExtension(sourceId), p.source);
	return !isThisProjectGro && groImportDir === p.dist
		? join(groImportDir, dirBasePath)
		: toBuildOutPath(dev, buildName, dirBasePath, p.build);
};

// TODO This function loses information. It's also hardcodedd to Gro's default file types.
// Maybe this points to a configurable system? Users can define their own extensions in Gro.
// Maybe `extensionConfigs: FilerExtensionConfig[]`.
export const toBuildExtension = (sourceId: string): string =>
	sourceId.endsWith(TS_EXTENSION)
		? replaceExtension(sourceId, JS_EXTENSION)
		: sourceId.endsWith(SVELTE_EXTENSION)
		? sourceId + JS_EXTENSION
		: sourceId;

// This implementation is complicated but it's fast.
// TODO see `toBuildExtension` comments for discussion about making this generic and configurable
export const toSourceExtension = (buildId: string): string => {
	let len = buildId.length;
	let i = len;
	let extensionCount = 1;
	let char: string | undefined;
	let extension1: string | null = null;
	let extension2: string | null = null;
	let extension3: string | null = null;
	while (true) {
		i--;
		if (i < 0) break;
		char = buildId[i];
		if (char === '/') break;
		if (char === '.') {
			const currentExtension = buildId.substring(i);
			if (extensionCount === 1) {
				extension1 = currentExtension;
				extensionCount = 2;
			} else if (extensionCount === 2) {
				extension2 = currentExtension;
				extensionCount = 3;
			} else if (extensionCount === 3) {
				extension3 = currentExtension;
				extensionCount = 4;
			} else {
				// don't handle any more extensions
				break;
			}
		}
	}
	switch (extension3) {
		case SVELTE_JS_SOURCEMAP_EXTENSION:
		case SVELTE_CSS_SOURCEMAP_EXTENSION: {
			return buildId.substring(0, len - extension2!.length);
		}
		// case undefined:
		// default:
		// 	return buildId;
		// 	break;
	}
	switch (extension2) {
		case SVELTE_JS_BUILD_EXTENSION:
		case SVELTE_CSS_BUILD_EXTENSION: {
			return buildId.substring(0, len - extension1!.length);
		}
		case JS_SOURCEMAP_EXTENSION: {
			return buildId.substring(0, len - extension2.length) + TS_EXTENSION;
		}
		// case undefined:
		// default:
		// 	return buildId;
		// 	break;
	}
	switch (extension1) {
		case SOURCEMAP_EXTENSION: {
			return buildId.substring(0, len - extension1.length);
		}
		case JS_EXTENSION: {
			return buildId.substring(0, len - extension1.length) + TS_EXTENSION;
		}
		// case undefined:
		// default:
		// 	return buildId;
		// 	break;
	}
	return buildId;
};

export const toDistOutDir = (name: BuildName, count: number, dir: string): string =>
	count === 1 ? dir : `${dir}/${name}`;

export const groImportDir = join(fileURLToPath(import.meta.url), '../');
export const groDir = join(
	groImportDir,
	join(groImportDir, '../../').endsWith(BUILD_DIR) ? '../../../' : '../', // yikes lol
);
export const groDirBasename = `${basename(groDir)}/`;
export const paths = createPaths(`${process.cwd()}/`);
export const isThisProjectGro = groDir === paths.root;
export const groPaths = isThisProjectGro ? paths : createPaths(groDir);

export const printPath = (path: string, p = paths, prefix = './'): string =>
	gray(`${prefix}${toRootPath(path, p)}`);

export const printPathOrGroPath = (path: string, fromPaths = paths): string => {
	const inferredPaths = pathsFromId(path);
	if (fromPaths === groPaths || inferredPaths === fromPaths) {
		return printPath(path, inferredPaths, '');
	} else {
		return gray(groDirBasename) + printPath(path, groPaths, '');
	}
};
