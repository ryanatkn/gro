import {sep, join} from 'path';

import {replaceExt} from './utils/path.js';
import {stripStart} from './utils/string.js';

/*

A path `id` is an absolute path to the source/build/dist directory.
It's the same nomenclature that Rollup uses.

A `basePath` is the format used by `CheapWatch`.
It's a bare relative path without a source or build directory,
e.g. 'foo/bar.ts'.

`CheapWatch` also uses an array of `pathParts`.
For path './foo/bar/baz.ts',
the `pathParts` are `['foo', 'foo/bar', 'foo/bar/baz.ts']`.

*/

// TODO pass these to `createPaths` and override from gro config
// TODO this is kinda gross - do we want to maintain the convention to have the trailing slash in most usage?
export const SOURCE_DIR_NAME = 'src';
export const BUILD_DIR_NAME = 'build';
export const DIST_DIR_NAME = 'dist';
export const SOURCE_DIR = SOURCE_DIR_NAME + sep;
export const BUILD_DIR = BUILD_DIR_NAME + sep;
export const DIST_DIR = DIST_DIR_NAME + sep;

export const RELATIVE_DIR_START = '.' + sep;

const createPaths = () => {
	const root = process.cwd() + sep;
	const source = join(root, SOURCE_DIR); // TODO should this be "src"? the helpers too?
	const build = join(root, BUILD_DIR);
	const dist = join(root, DIST_DIR);
	return {
		root,
		source,
		build,
		dist,
		temp: join(build, 'temp'), // can write anything here for e.g. testing
	};
};

export const paths = createPaths();

export const isId = (id: string): boolean => id.startsWith(paths.root);
export const isSourceId = (id: string): boolean => id.startsWith(paths.source);
export const isBuildId = (id: string): boolean => id.startsWith(paths.build);
export const isDistId = (id: string): boolean => id.startsWith(paths.dist);

export const toRootPath = (id: string): string => stripStart(id, paths.root);

// '/home/me/app/build/foo/bar/baz.js' -> 'foo/bar/baz.js'
// '/home/me/app/src/foo/bar/baz.ts' -> 'foo/bar/baz.ts'
export const toBasePath = (id: string): string =>
	stripStart(stripStart(stripStart(id, paths.build), paths.source), paths.dist);

// '/home/me/app/build/foo/bar/baz.js' -> 'src/foo/bar/baz.ts'
export const toSourcePath = (id: string): string =>
	isSourceId(id)
		? stripStart(id, paths.root)
		: toSourceExt(join(SOURCE_DIR, toBasePath(id)));

// '/home/me/app/src/foo/bar/baz.ts' -> 'build/foo/bar/baz.js'
export const toBuildPath = (id: string): string =>
	isBuildId(id)
		? stripStart(id, paths.root)
		: isDistId(id)
		? join(BUILD_DIR, toBasePath(id))
		: toCompiledExt(join(BUILD_DIR, toBasePath(id)));

// '/home/me/app/src/foo/bar/baz.ts' -> 'dist/foo/bar/baz.js'
export const toDistPath = (id: string): string =>
	isDistId(id)
		? stripStart(id, paths.root)
		: isBuildId(id)
		? join(DIST_DIR, toBasePath(id))
		: toCompiledExt(join(DIST_DIR, toBasePath(id)));

// '/home/me/app/build/foo/bar/baz.js' -> '/home/me/app/src/foo/bar/baz.ts'
export const toSourceId = (id: string): string =>
	isSourceId(id) ? id : join(paths.root, toSourcePath(id));

// '/home/me/app/src/foo/bar/baz.ts' -> '/home/me/app/build/foo/bar/baz.js'
export const toBuildId = (id: string): string =>
	isBuildId(id) ? id : join(paths.root, toBuildPath(id));

// '/home/me/app/src/foo/bar/baz.ts' -> '/home/me/app/dist/foo/bar/baz.js'
export const toDistId = (id: string): string =>
	isDistId(id) ? id : join(paths.root, toDistPath(id));

// 'foo/bar/baz.ts' -> '/home/me/app/src/foo/bar/baz.ts'
export const basePathToSourceId = (basePath: string): string =>
	join(paths.source, basePath);

// 'foo/bar/baz.js' -> '/home/me/app/build/foo/bar/baz.js'
export const basePathToBuildId = (basePath: string): string =>
	join(paths.build, basePath);

// 'foo/bar/baz.js' -> '/home/me/app/dist/foo/bar/baz.js'
export const basePathToDistId = (basePath: string): string =>
	join(paths.dist, basePath);

export const stripRelativePath = (path: string): string =>
	stripStart(path, RELATIVE_DIR_START);

export const JS_EXT = '.js';
export const TS_EXT = '.ts';
export const SVELTE_EXT = '.svelte';
export const SOURCE_EXTS = [TS_EXT, SVELTE_EXT];

export const hasSourceExt = (path: string): boolean =>
	SOURCE_EXTS.some(ext => path.endsWith(ext));

export const toSourceExt = (path: string): string =>
	path.endsWith(JS_EXT) ? replaceExt(path, TS_EXT) : path; // TODO? how does this work with `.svelte`? do we need more metadata?

// compiled includes both build and dist
export const toCompiledExt = (path: string): string =>
	hasSourceExt(path) ? replaceExt(path, JS_EXT) : path;

// Gets the individual parts of a path, ignoring dots and separators.
// toPathSegments('/foo/bar/baz.ts') => ['foo', 'bar', 'baz.ts']
export const toPathSegments = (path: string): string[] =>
	path.split(sep).filter(s => s && s !== '.');

// Designed for the `cheap-watch` API.
// toPathParts('./foo/bar/baz.ts') => ['foo', 'foo/bar', 'foo/bar/baz.ts']
export const toPathParts = (path: string): string[] => {
	const segments = toPathSegments(path);
	let currentPath = path[0] === sep ? sep : '';
	return segments.map(segment => {
		if (!currentPath || currentPath === sep) {
			currentPath += segment;
		} else {
			currentPath += sep + segment;
		}
		return currentPath;
	});
};
