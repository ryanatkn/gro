import {join, sep} from 'path';
import {gray} from 'kleur';

import {resolvePath, replaceExt} from './utils/pathUtils.js';
import {logger, LogLevel} from './utils/logUtils.js';
import {stripStart} from './utils/stringUtils.js';

/*

A path `id` is an absolute path to the build or source directory.
It's the same nomenclature that Rollup uses.

A `basePath` is the format used by `CheapWatch`.
It's a bare relative path without a source or build directory,
e.g. 'foo/bar.ts'.

`CheapWatch` also uses an array of `pathParts`.
For path './foo/bar/baz.ts',
the `pathParts` are `['foo', 'foo/bar', 'foo/bar/baz.ts']`.

*/

const {info} = logger(LogLevel.Info, [gray('[paths]')]); // TODO log level from env var? param?

// TODO pass these to `createPaths` and override from gro config
export const SOURCE_DIR = 'src' + sep;
export const BUILD_DIR = 'build' + sep;

export const RELATIVE_DIR_START = '.' + sep;

const createPaths = () => {
	const root = resolvePath('./') + sep;
	const source = join(root, SOURCE_DIR);
	const build = join(root, BUILD_DIR);
	return {
		root,
		source,
		build,
	};
};

export const paths = createPaths();
info(paths);

export const isId = (id: string): boolean => id.startsWith(paths.root);
export const isSourceId = (id: string): boolean => id.startsWith(paths.source);
export const isBuildId = (id: string): boolean => id.startsWith(paths.build);

export const toRootPath = (id: string): string => stripStart(id, paths.root);

// '/home/me/app/build/foo/bar/baz.js' -> 'foo/bar/baz.js'
// '/home/me/app/src/foo/bar/baz.ts' -> 'foo/bar/baz.ts'
export const toBasePath = (id: string): string =>
	stripStart(stripStart(id, paths.build), paths.source);

// '/home/me/app/build/foo/bar/baz.js' -> 'src/foo/bar/baz.ts'
export const toSourcePath = (id: string): string =>
	isSourceId(id)
		? stripStart(id, paths.root)
		: toSourceExt(join(SOURCE_DIR, toBasePath(id)));

// '/home/me/app/src/foo/bar/baz.ts' -> 'build/foo/bar/baz.js'
export const toBuildPath = (id: string): string =>
	isBuildId(id)
		? stripStart(id, paths.root)
		: toBuildExt(join(BUILD_DIR, toBasePath(id)));

// '/home/me/app/build/foo/bar/baz.js' -> '/home/me/app/src/foo/bar/baz.ts'
export const toSourceId = (id: string): string =>
	isSourceId(id) ? id : join(paths.root, toSourcePath(id));

// '/home/me/app/src/foo/bar/baz.ts' -> '/home/me/app/build/foo/bar/baz.js'
export const toBuildId = (id: string): string =>
	isBuildId(id) ? id : join(paths.root, toBuildPath(id));

// 'foo/bar/baz.ts' -> '/home/me/app/build/foo/bar/baz.ts'
export const basePathToSourceId = (basePath: string): string =>
	join(paths.source, basePath);

// 'foo/bar/baz.js' -> '/home/me/app/build/foo/bar/baz.js'
export const basePathToBuildId = (basePath: string): string =>
	join(paths.build, basePath);

// converts various path types to an absolute id,
// inferring build/source directory if needed
export const normalizeToId = (rawPath: string): string => {
	if (rawPath.startsWith(paths.root)) {
		return rawPath;
	}
	let path = stripStart(rawPath, RELATIVE_DIR_START);
	if (path.startsWith(BUILD_DIR) || path.startsWith(SOURCE_DIR)) {
		return join(paths.root, path);
	}
	// is a base path, so we need to use heuristics
	// to determine if it's a build or source path
	if (hasSourceExt(path)) {
		// inferred to be a basePath off SOURCE_DIR
		return basePathToSourceId(path);
	} else {
		// inferred to be basePath off BUILD_DIR
		return basePathToBuildId(path);
	}
};

export const JS_EXT = '.js';
export const TS_EXT = '.ts';
export const SVELTE_EXT = '.svelte';
export const SOURCE_EXTS = [TS_EXT, SVELTE_EXT];

export const hasSourceExt = (path: string): boolean =>
	SOURCE_EXTS.some(ext => path.endsWith(ext));

export const toSourceExt = (path: string): string =>
	path.endsWith(JS_EXT) ? replaceExt(path, TS_EXT) : path; // TODO? how does this work with `.svelte`?

export const toBuildExt = (path: string): string =>
	hasSourceExt(path) ? replaceExt(path, JS_EXT) : path;

// Designed for the `cheap-watch` API. See notes above.
export const toPathParts = (path: string): string[] => {
	const parts = stripStart(path, '.')
		.split(sep)
		.filter(Boolean);
	let currentPath: string | undefined;
	return parts.map(part => {
		if (currentPath === undefined) {
			currentPath = part;
		} else {
			currentPath += sep + part;
		}
		return currentPath;
	});
};
