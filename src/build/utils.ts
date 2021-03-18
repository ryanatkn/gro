import {createHash} from 'crypto';
import {resolve} from 'path';

import {basePathToSourceId, paths, toBuildBasePath, toSourceExtension} from '../paths.js';
import {BuildDependency} from './builder.js';
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
