import {createHash} from 'crypto';
import {resolve} from 'path';

import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIR,
	paths,
	toBuildBasePath,
	toSourceExtension,
} from '../paths.js';
import {COMMON_SOURCE_ID} from './buildFile.js';
import {BuildDependency} from './builder.js';

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
	(dependency: BuildDependency, buildRootDir: string): string;
}

const COMMONS_ID_PREFIX = `${EXTERNALS_BUILD_DIR}/${COMMON_SOURCE_ID}/`;

export const mapDependencyToSourceId: MapDependencyToSourceId = (dependency, buildRootDir) => {
	const basePath = toBuildBasePath(dependency.buildId, buildRootDir);
	if (dependency.external) {
		if (basePath.startsWith(COMMONS_ID_PREFIX)) {
			return COMMON_SOURCE_ID;
		} else {
			return dependency.specifier;
		}
	} else {
		return basePathToSourceId(toSourceExtension(basePath));
	}
};
