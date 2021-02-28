import {createHash} from 'crypto';
import {resolve} from 'path';

import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIR,
	JS_EXTENSION,
	// JS_EXTENSION,
	paths,
	toBuildBasePath,
	toSourceExtension,
} from '../paths.js';
// import {stripEnd, stripStart} from '../utils/string.js';
import {COMMON_SOURCE_ID} from './buildFile.js';
import {stripEnd, stripStart} from '../utils/string.js';

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
	(buildId: string, external: boolean, buildRootDir: string): string;
}

const EXTERNALS_ID_PREFIX = `${EXTERNALS_BUILD_DIR}/`;
const COMMONS_ID_PREFIX = `${EXTERNALS_ID_PREFIX}${COMMON_SOURCE_ID}/`;

// TODO has weird special cases, needs refactoring
export const mapBuildIdToSourceId: MapBuildIdToSourceId = (
	buildId,
	external,
	buildRootDir: string,
) => {
	const basePath = toBuildBasePath(buildId, buildRootDir);
	if (external) {
		// 	? stripStart(stripEnd(basePath, JS_EXTENSION), EXTERNALS_ID_PREFIX)
		if (basePath.startsWith(COMMONS_ID_PREFIX)) {
			return COMMON_SOURCE_ID;
		} else {
			// TODO this is hacky!
			// oh so hacky
			// maybe `validatePackageName` is appropriate?
			// see https://github.com/snowpackjs/snowpack/blob/a09bba81d01fa7b3769024f9bd5adf0d3fc4bafc/esinstall/src/util.ts
			// and https://github.com/npm/validate-npm-package-name
			const withoutPrefix = stripStart(basePath, EXTERNALS_ID_PREFIX);
			const stripSuffix = withoutPrefix.startsWith('@feltcoop/gro/dist/') ? '' : JS_EXTENSION;
			const sourceId = stripEnd(withoutPrefix, stripSuffix);
			console.log('sourceId', sourceId);
			return sourceId;
		}
	} else {
		return basePathToSourceId(toSourceExtension(basePath));
	}
};
