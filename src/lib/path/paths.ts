import {join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {replaceExtension, stripTrailingSlash} from '@feltjs/util/path.js';
import {stripStart} from '@feltjs/util/string.js';
import {gray} from 'kleur/colors';
import type {Flavored} from '@feltjs/util/types.js';

import type {BuildName} from '../build/buildConfig.js';

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
export const LIB_DIRNAME = 'lib';
export const DIST_DIRNAME = BUILD_DIRNAME + '/dist';
export const SOURCE_DIR = SOURCE_DIRNAME + '/';
export const BUILD_DIR = BUILD_DIRNAME + '/';
export const DIST_DIR = DIST_DIRNAME + '/';
export const LIB_PATH = SOURCE_DIR + LIB_DIRNAME;
export const LIB_DIR = LIB_PATH + '/';

export const CONFIG_SOURCE_PATH = 'gro.config.ts';
export const CONFIG_BUILD_PATH = 'gro.config.js';

export const JS_EXTENSION = '.js';
export const TS_EXTENSION = '.ts';
export const CSS_EXTENSION = '.css';
export const JSON_EXTENSION = '.json';
export const JSON_JS_EXTENSION = '.json.js';
export const SOURCEMAP_EXTENSION = '.map';
export const JS_SOURCEMAP_EXTENSION = '.js.map';

export const README_FILENAME = 'README.md';
export const SVELTEKIT_CONFIG_FILENAME = 'svelte.config.cjs';
export const SVELTEKIT_DEV_DIRNAME = '.svelte-kit';
export const SVELTEKIT_TSCONFIG = '.svelte-kit/tsconfig.json';
export const SVELTEKIT_BUILD_DIRNAME = 'build';
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
	lib: string;
	build: string;
	dist: string;
	configSourceId: string;
}

export type SourceId = Flavored<string, 'SourceId'>;
export type BuildId = Flavored<string, 'BuildId'>;

export const createPaths = (rootDir: string): Paths => {
	const root = stripTrailingSlash(rootDir) + '/';
	const source = root + SOURCE_DIR;
	const build = root + BUILD_DIR;
	return {
		root,
		source,
		lib: root + LIB_DIR,
		build,
		dist: root + DIST_DIR,
		configSourceId: source + CONFIG_SOURCE_PATH,
	};
};

export const pathsFromId = (id: string): Paths => (isGroId(id) ? groPaths : paths);
export const isGroId = (id: string): boolean => id.startsWith(groPaths.root);

export const isSourceId = (id: string, p = paths): boolean => id.startsWith(p.source);

// '/home/me/app/src/foo/bar/baz.ts' → 'src/foo/bar/baz.ts'
export const toRootPath = (id: string, p = paths): string => stripStart(id, p.root);

// TODO this is more like `toBasePath`
// '/home/me/app/src/foo/bar/baz.ts' → 'foo/bar/baz.ts'
export const sourceIdToBasePath = (sourceId: SourceId, p = paths): string =>
	stripStart(sourceId, p.source);

// '/home/me/app/.gro/[prod|dev]/buildName/foo/bar/baz.js' → '/home/me/app/src/foo/bar/baz.ts'
export const buildIdToSourceId = (
	buildId: BuildId,
	buildDir = paths.build,
	p = paths,
): SourceId => {
	const basePath = toBuildBasePath(buildId, buildDir);
	return basePathToSourceId(toSourceExtension(basePath), p);
};

// 'foo/bar/baz.ts' → '/home/me/app/src/foo/bar/baz.ts'
export const basePathToSourceId = (basePath: string, p = paths): SourceId =>
	`${p.source}${basePath}`;

// TODO the `stripTrailingSlash` is a hack
export const toBuildOutDir = (dev: boolean, buildDir = paths.build): string =>
	`${stripTrailingSlash(buildDir)}/${toBuildOutDirname(dev)}`;
export const toBuildOutDirname = (dev: boolean): BuildOutDirname =>
	dev ? BUILD_DIRNAME_DEV : BUILD_DIRNAME_PROD;
export const BUILD_DIRNAME_DEV = 'dev';
export const BUILD_DIRNAME_PROD = 'prod';
export type BuildOutDirname = 'dev' | 'prod';

export const TYPES_BUILD_DIRNAME = 'types';
export const toTypesBuildDir = (p = paths): string => `${p.build}${TYPES_BUILD_DIRNAME}`;

export const toBuildOutPath = (
	dev: boolean,
	buildName: BuildName,
	basePath = '',
	buildDir = paths.build,
): string => `${toBuildOutDir(dev, buildDir)}/${buildName}/${basePath}`;

export const toBuildBasePath = (buildId: BuildId, buildDir = paths.build): string => {
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
	path.endsWith(TS_EXTENSION) || path.endsWith(JSON_EXTENSION);

// Can be used to map a source id from e.g. the cwd to gro's.
export const replaceRootDir = (id: string, rootDir: string, p = paths): string =>
	join(rootDir, toRootPath(id, p));

// TODO This function loses information,
// and it's also hardcoded to Gro's default file types and output conventions.
// Maybe this points to a configurable system? Users can define their own extensions in Gro.
// Maybe `extensionConfigs: FilerExtensionConfig[]`.
// Or maybe just follow the lead of Rollup/esbuild?
export const toBuildExtension = (sourceId: SourceId): string =>
	sourceId.endsWith(TS_EXTENSION)
		? replaceExtension(sourceId, JS_EXTENSION)
		: sourceId.endsWith(JSON_EXTENSION)
		? sourceId + JS_EXTENSION
		: sourceId;

// This implementation is complicated but it's fast.
// TODO see `toBuildExtension` comments for discussion about making this generic and configurable
export const toSourceExtension = (buildId: BuildId): string => {
	const len = buildId.length;
	let i = len;
	let extensionCount = 1;
	let char: string | undefined;
	let extension1: string | null = null;
	let extension2: string | null = null;
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
			} else {
				// don't handle any more extensions
				break;
			}
		}
	}
	switch (extension2) {
		case JSON_JS_EXTENSION:
			return buildId.substring(0, len - extension1!.length);
		case JS_SOURCEMAP_EXTENSION:
			return buildId.substring(0, len - extension2.length) + TS_EXTENSION;
		default:
			break;
	}
	switch (extension1) {
		case SOURCEMAP_EXTENSION:
			return buildId.substring(0, len - extension1.length);
		case JS_EXTENSION:
			return buildId.substring(0, len - extension1.length) + TS_EXTENSION;
		default:
			break;
	}
	return buildId;
};

// Converts a source id into an id that can be imported.
// When importing from inside Gro's own internal dist/ directory,
// it returns a relative path and ignores `dev` and `buildName`.
export const toImportId = (
	sourceId: SourceId,
	dev: boolean,
	buildName: BuildName,
	p = pathsFromId(sourceId),
): string => {
	const dirBasePath = stripStart(toBuildExtension(sourceId), p.source);
	return !isThisProjectGro && groImportDir === p.dist
		? join(groImportDir, dirBasePath)
		: toBuildOutPath(dev, buildName, dirBasePath, p.build);
};

export const groImportDir = join(fileURLToPath(import.meta.url), '../../../');
export const groDir = join(
	groImportDir,
	join(groImportDir, '../../').endsWith(BUILD_DIR) ? '../../../' : './',
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
	}
	return gray(groDirBasename) + printPath(path, groPaths, '');
};