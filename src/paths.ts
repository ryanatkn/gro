import {join, basename} from 'path';
import {fileURLToPath} from 'url';

import {replaceExtension} from './utils/path.js';
import {stripStart} from './utils/string.js';

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
export const SOURCE_DIR_NAME = 'src';
export const BUILD_DIR_NAME = '.gro';
export const DIST_DIR_NAME = 'dist';
export const SOURCE_DIR = `${SOURCE_DIR_NAME}/`;
export const BUILD_DIR = `${BUILD_DIR_NAME}/`;
export const DIST_DIR = `${DIST_DIR_NAME}/`;

export const CONFIG_SOURCE_BASE_PATH = 'gro.config.ts';
export const CONFIG_BUILD_BASE_PATH = 'gro.config.js';

export const EXTERNALS_BUILD_DIR = 'externals'; // TODO breaks the above trailing slash convention - revisit with trailing-slash branch
export const EXTERNALS_BUILD_DIR_SUBPATH = `/${EXTERNALS_BUILD_DIR}/`;

export interface Paths {
	root: string;
	source: string;
	build: string;
	dist: string;
	configSourceId: string;
}

export const createPaths = (root: string): Paths => {
	root = ensureTrailingSlash(root);
	const source = `${root}${SOURCE_DIR}`;
	const build = `${root}${BUILD_DIR}`;
	return {
		root,
		source,
		build,
		dist: `${root}${DIST_DIR}`,
		configSourceId: `${source}${CONFIG_SOURCE_BASE_PATH}`,
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

export const toBuildsOutDir = (dev: boolean, buildRootDir = paths.build): string =>
	`${ensureTrailingSlash(buildRootDir)}${dev ? 'dev' : 'prod'}`;
// TODO this is only needed because of how we added `/` to all directories above
// fix those and remove this!
function ensureTrailingSlash(s: string): string {
	return s[s.length - 1] === '/' ? s : s + '/';
}

export const toBuildOutPath = (
	dev: boolean,
	buildConfigName: string,
	basePath = '',
	buildRootDir = paths.build,
): string => `${toBuildsOutDir(dev, buildRootDir)}/${buildConfigName}/${basePath}`;

export const toBuildBasePath = (buildId: string, buildRootDir = paths.build): string => {
	const rootPath = stripStart(buildId, buildRootDir);
	let separatorCount = 0;
	for (let i = 0; i < rootPath.length; i++) {
		if (rootPath[i] === '/') separatorCount++;
		if (separatorCount === 2) {
			// `2` to strip the dev/prod directory and the build out directory
			return rootPath.substring(i + 1);
		}
	}
	throw Error(`Invalid build id, cannot convert to build base path: ${buildId}`);
};

export const JS_EXTENSION = '.js';
export const TS_EXTENSION = '.ts';
export const TS_DEFS_EXTENSION = '.d.ts';
export const CSS_EXTENSION = '.css';
export const SVELTE_EXTENSION = '.svelte';
export const SVELTE_JS_BUILD_EXTENSION = '.svelte.js';
export const SVELTE_CSS_BUILD_EXTENSION = '.svelte.css';
export const JSON_EXTENSION = '.json';
export const SOURCEMAP_EXTENSION = '.map';
export const JS_SOURCEMAP_EXTENSION = '.js.map';
export const SVELTE_JS_SOURCEMAP_EXTENSION = '.svelte.js.map';
export const SVELTE_CSS_SOURCEMAP_EXTENSION = '.svelte.css.map';

// TODO probably change this to use a regexp (benchmark?)
export const hasSourceExtension = (path: string): boolean =>
	(path.endsWith(TS_EXTENSION) && !path.endsWith(TS_DEFS_EXTENSION)) ||
	path.endsWith(SVELTE_EXTENSION);

// Gets the individual parts of a path, ignoring dots and separators.
// toPathSegments('/foo/bar/baz.ts') => ['foo', 'bar', 'baz.ts']
export const toPathSegments = (path: string): string[] =>
	path.split('/').filter((s) => s && s !== '.');

// Designed for the `cheap-watch` API.
// toPathParts('./foo/bar/baz.ts') => ['foo', 'foo/bar', 'foo/bar/baz.ts']
export const toPathParts = (path: string): string[] => {
	const segments = toPathSegments(path);
	let currentPath = path[0] === '/' ? '/' : '';
	return segments.map((segment) => {
		if (!currentPath || currentPath === '/') {
			currentPath += segment;
		} else {
			currentPath += '/' + segment;
		}
		return currentPath;
	});
};

// Can be used to map a source id from e.g. the cwd to gro's.
export const replaceRootDir = (id: string, rootDir: string, p = paths): string =>
	join(rootDir, toRootPath(id, p));

// Converts a source id into an id that can be imported.
// When importing Gro paths, this correctly chooses the build or dist dir.
export const toImportId = (sourceId: string, dev: boolean, buildConfigName: string): string => {
	const p = pathsFromId(sourceId);
	const dirBasePath = stripStart(toBuildExtension(sourceId), p.source);
	return toBuildOutPath(dev, buildConfigName, dirBasePath, p.build);
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

export const groImportDir = join(fileURLToPath(import.meta.url), '../');
export const groDir = join(
	groImportDir,
	join(groImportDir, '../../').endsWith(BUILD_DIR) ? '../../../' : '../', // yikes lol
);
export const groDirBasename = `${basename(groDir)}/`;
export const paths = createPaths(`${process.cwd()}/`);
export const isThisProjectGro = groDir === paths.root;
export const groPaths = isThisProjectGro ? paths : createPaths(groDir);
