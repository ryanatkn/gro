import {
	toPathParts,
	toRootPath,
	toSourcePath,
	toSourceId,
	toBasePath,
} from '../paths';

export interface FileData {
	// `id` is synonymous with `buildId` or `absoluteBuildPath` in this case
	// `buildPath` is therefore also the `rootPath`
	// `basePath` and `basePathParts` are formatted the way `CheapWatch` expects
	id: string; //'/home/me/app/build/foo/bar/baz.js'
	basePath: string; // 'foo/bar/baz.js' - relative to build directory
	basePathParts: string[]; // ['foo', 'foo/bar', 'foo/bar/baz.js']
	buildPath: string; // 'build/foo/bar/baz.js'
	sourcePath: string; // 'src/foo/bar/baz.ts'
	sourceId: string; // '/home/me/app/src/foo/bar/baz.ts'
	stats: FileStats;
}

export interface FileStats {
	isDirectory(): boolean;
}

export const toFileData = (id: string, stats: FileStats): FileData => {
	const basePath = toBasePath(id);
	return {
		id,
		basePath,
		basePathParts: toPathParts(basePath),
		buildPath: toRootPath(id),
		sourcePath: toSourcePath(id),
		sourceId: toSourceId(id),
		stats,
	};
};
