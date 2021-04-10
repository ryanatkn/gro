import {createHash} from 'crypto';
import {resolve} from 'path';

import type {BuildConfig} from '../config/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {basePathToSourceId, paths, toBuildBasePath, toSourceExtension} from '../paths.js';
import type {BuildDependency} from './builder.js';
import {EXTERNALS_SOURCE_ID} from './externalsBuildHelpers.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const toHash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

interface FilterDirectory {
	(id: string): boolean;
}

export const createDirectoryFilter = (dir: string, rootDir = paths.source): FilterDirectory => {
	dir = resolve(rootDir, dir);
	const dirWithTrailingSlash = dir + '/';
	const filterDirectory: FilterDirectory = (id) =>
		id === dir || id.startsWith(dirWithTrailingSlash);
	return filterDirectory;
};

export interface MapDependencyToSourceId {
	(dependency: BuildDependency, buildDir: string): string;
}

// TODO this could be `MapBuildIdToSourceId` and infer externals from the `basePath`
export const mapDependencyToSourceId: MapDependencyToSourceId = (dependency, buildDir) => {
	// TODO this is failing with build ids like `terser` - should that be the build id? yes?
	// dependency.external
	const basePath = toBuildBasePath(dependency.buildId, buildDir);
	if (dependency.external) {
		return EXTERNALS_SOURCE_ID;
	} else {
		return basePathToSourceId(toSourceExtension(basePath));
	}
};

export const addJsSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const addCssSourcemapFooter = (code: string, sourcemapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourcemapPath} */`;

// TODO use `resolveRawInputPaths`? consider the virtual fs - use the `Filer` probably
export const resolveInputFiles = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
): Promise<string[]> =>
	(
		await Promise.all(
			buildConfig.input.map(async (input) =>
				typeof input === 'string' && (await fs.pathExists(input)) ? input : null!,
			),
		)
	).filter(Boolean);
