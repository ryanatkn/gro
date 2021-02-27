import {createHash} from 'crypto';
import {resolve} from 'path';
import {BuildConfig} from '../config/buildConfig.js';

import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIR,
	JS_EXTENSION,
	paths,
	toBuildBasePath,
	toSourceExtension,
} from '../paths.js';
import {stripEnd, stripStart} from '../utils/string.js';
import {COMMON_SOURCE_ID, isExternalBuildId} from './buildFile.js';

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

export interface MapBuildIdToSourceId {
	(
		buildId: string,
		external: boolean,
		dev: boolean,
		buildConfig: BuildConfig,
		buildRootDir: string,
	): string;
}

const EXTERNALS_ID_PREFIX = `${EXTERNALS_BUILD_DIR}/`;
const COMMONS_ID_PREFIX = `${EXTERNALS_ID_PREFIX}${COMMON_SOURCE_ID}/`;

// TODO has weird special cases, points to refactoring
export const mapBuildIdToSourceId: MapBuildIdToSourceId = (
	buildId,
	external,
	dev,
	buildConfig,
	buildRootDir,
) => {
	const basePath = toBuildBasePath(buildId, buildRootDir);
	const sourceId = external
		? basePath.startsWith(COMMONS_ID_PREFIX)
			? COMMON_SOURCE_ID
			: isExternalBuildId(buildId, dev, buildConfig, buildRootDir)
			? stripStart(stripEnd(basePath, JS_EXTENSION), EXTERNALS_ID_PREFIX)
			: buildId
		: basePathToSourceId(toSourceExtension(basePath));
	return sourceId;
};
