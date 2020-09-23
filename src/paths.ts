import {sep, join, basename} from 'path';
import {fileURLToPath} from 'url';

import {hasExtension, replaceExtension} from './utils/path.js';
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

export interface Paths {
	root: string;
	source: string;
	build: string;
	dist: string;
	temp: string;
}

export const createPaths = (root: string): Paths => {
	if (!root.endsWith(sep)) root = root + sep;
	const source = join(root, SOURCE_DIR); // TODO should this be "src"? the helpers too?
	const build = join(root, BUILD_DIR);
	const dist = join(root, DIST_DIR);
	return {
		root,
		source,
		build,
		dist,
		temp: join(build, 'temp/'), // can write anything here for e.g. testing
	};
};

export const paths = createPaths(process.cwd() + sep);
export const groImportDir = join(fileURLToPath(import.meta.url), '../');
export const groDir = join(groImportDir, '../');
export const groDirBasename = basename(groDir) + sep;
export const groPaths = groDir === paths.root ? paths : createPaths(groDir);

export const pathsFromId = (id: string): Paths => (isGroId(id) ? groPaths : paths);
export const isGroId = (id: string): boolean => id.startsWith(groPaths.root);

export const isSourceId = (id: string, p = paths): boolean => id.startsWith(p.source);
export const isBuildId = (id: string, p = paths): boolean => id.startsWith(p.build);
export const isDistId = (id: string, p = paths): boolean => id.startsWith(p.dist);

export const toRootPath = (id: string, p = paths): string => stripStart(id, p.root);

// '/home/me/app/build/foo/bar/baz.js' -> 'foo/bar/baz.js'
// '/home/me/app/src/foo/bar/baz.ts' -> 'foo/bar/baz.ts'
export const toBasePath = (id: string, p = paths): string =>
	stripStart(stripStart(stripStart(id, p.build), p.source), p.dist);

// '/home/me/app/build/foo/bar/baz.js' -> 'src/foo/bar/baz.ts'
export const toSourcePath = (id: string, p = paths): string =>
	isSourceId(id, p)
		? stripStart(id, p.root)
		: toSourceExtension(join(SOURCE_DIR, toBasePath(id, p)));

// '/home/me/app/src/foo/bar/baz.ts' -> 'build/foo/bar/baz.js'
export const toBuildPath = (id: string, p = paths): string =>
	isBuildId(id, p)
		? stripStart(id, p.root)
		: isDistId(id, p)
		? join(BUILD_DIR, toBasePath(id, p))
		: toCompiledExtension(join(BUILD_DIR, toBasePath(id, p)));

// '/home/me/app/src/foo/bar/baz.ts' -> 'dist/foo/bar/baz.js'
export const toDistPath = (id: string, p = paths): string =>
	isDistId(id, p)
		? stripStart(id, p.root)
		: isBuildId(id, p)
		? join(DIST_DIR, toBasePath(id, p))
		: toCompiledExtension(join(DIST_DIR, toBasePath(id, p)));

// '/home/me/app/build/foo/bar/baz.js' -> '/home/me/app/src/foo/bar/baz.ts'
export const toSourceId = (id: string, p = paths): string =>
	isSourceId(id, p) ? id : join(p.root, toSourcePath(id, p));

// '/home/me/app/src/foo/bar/baz.ts' -> '/home/me/app/build/foo/bar/baz.js'
export const toBuildId = (id: string, p = paths): string =>
	isBuildId(id, p) ? id : join(p.root, toBuildPath(id, p));

// '/home/me/app/src/foo/bar/baz.ts' -> '/home/me/app/dist/foo/bar/baz.js'
export const toDistId = (id: string, p = paths): string =>
	isDistId(id, p) ? id : join(p.root, toDistPath(id, p));

// 'foo/bar/baz.ts' -> '/home/me/app/src/foo/bar/baz.ts'
export const basePathToSourceId = (basePath: string, p = paths): string => join(p.source, basePath);

// 'foo/bar/baz.js' -> '/home/me/app/build/foo/bar/baz.js'
export const basePathToBuildId = (basePath: string, p = paths): string => join(p.build, basePath);

// 'foo/bar/baz.js' -> '/home/me/app/dist/foo/bar/baz.js'
export const basePathToDistId = (basePath: string, p = paths): string => join(p.dist, basePath);

export const stripRelativePath = (path: string): string => stripStart(path, RELATIVE_DIR_START);

export const JS_EXTENSION = '.js';
export const TS_EXTENSION = '.ts';
export const SVELTE_EXTENSION = '.svelte';
export const SOURCE_EXTENSIONS = [TS_EXTENSION, SVELTE_EXTENSION];
export const SOURCE_MAP_EXTENSION = '.map';

export const hasSourceExtension = (path: string): boolean => hasExtension(path, SOURCE_EXTENSIONS);

export const toSourceExtension = (path: string): string =>
	path.endsWith(JS_EXTENSION) ? replaceExtension(path, TS_EXTENSION) : path; // TODO? how does this work with `.svelte`? do we need more metadata?

// compiled includes both build and dist
export const toCompiledExtension = (path: string): string =>
	hasSourceExtension(path) ? replaceExtension(path, JS_EXTENSION) : path;

// TODO need better integration with this
export const toSvelteExtension = (path: string): string =>
	path.endsWith(JS_EXTENSION) ? replaceExtension(path, SVELTE_EXTENSION) : path;

export const toSourceMapPath = (path: string): string =>
	`${toCompiledExtension(path)}${SOURCE_MAP_EXTENSION}`;

// This differs from `toSourceId` by handling `.map` files, so it's not two-way.
// There might be a cleaner design in here somewhere.
export const fromSourceMappedBuildIdToSourceId = (id: string): string =>
	toSourceId(id.endsWith(SOURCE_MAP_EXTENSION) ? replaceExtension(id, '') : id);

// Gets the individual parts of a path, ignoring dots and separators.
// toPathSegments('/foo/bar/baz.ts') => ['foo', 'bar', 'baz.ts']
export const toPathSegments = (path: string): string[] =>
	path.split(sep).filter((s) => s && s !== '.');

// Designed for the `cheap-watch` API.
// toPathParts('./foo/bar/baz.ts') => ['foo', 'foo/bar', 'foo/bar/baz.ts']
export const toPathParts = (path: string): string[] => {
	const segments = toPathSegments(path);
	let currentPath = path[0] === sep ? sep : '';
	return segments.map((segment) => {
		if (!currentPath || currentPath === sep) {
			currentPath += segment;
		} else {
			currentPath += sep + segment;
		}
		return currentPath;
	});
};

// Can be used to map a source id from e.g. the cwd to gro's.
export const replaceRootDir = (id: string, rootDir: string, p = paths): string =>
	join(rootDir, toRootPath(id, p));

// Converts a source id into an id that can be imported.
// When importing Gro paths, this correctly chooses the build or dist dir.
export const toImportId = (id: string): string => {
	const p = pathsFromId(id);
	return p === groPaths
		? toCompiledExtension(join(groImportDir, toBasePath(id, p)))
		: toBuildId(id, p);
};
