import {createHash} from 'crypto';
import {resolve} from 'path';

import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIR,
	JS_EXTENSION,
	paths,
	toBuildBasePath,
	toSourceExtension,
} from '../paths.js';
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
	(buildId: string, external: boolean): string;
}

const EXTERNALS_ID_PREFIX = `/${EXTERNALS_BUILD_DIR}/`;
const EXTERNALS_ID_SUFFIX = JS_EXTENSION;
const EXTERNALS_INDEX_SUFFIX = ''; // TODO probably should use a regexp matcher combined with the JS suffix

export const mapBuildIdToSourceId: MapBuildIdToSourceId = (buildId, external) =>
	external
		? buildId.startsWith(EXTERNALS_ID_PREFIX)
			? stripEnd(
					stripEnd(stripStart(buildId, EXTERNALS_ID_PREFIX), EXTERNALS_ID_SUFFIX),
					EXTERNALS_INDEX_SUFFIX,
			  )
			: buildId
		: basePathToSourceId(toSourceExtension(toBuildBasePath(buildId)));
