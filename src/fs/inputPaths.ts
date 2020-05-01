import {join, sep, isAbsolute} from 'path';

import {
	basePathToSourceId,
	stripRelativePath,
	SOURCE_DIR,
	SOURCE_DIR_NAME,
	replaceRootDir,
	Paths,
} from '../paths.js';
import {stripStart} from '../utils/string.js';
import {PathData, toPathData, PathStats} from './pathData.js';

/*

Raw input paths are paths that users provide to Gro to reference files
enhanced with Gro's conventions like `.test.`, `.task.`, and `.gen.`.

A raw input path can be:

- a direct fully qualified file, e.g. `src/foo/bar.test.ts`
- a file without an extension, e.g. `src/foo/bar` if `extensions` is `.test.ts`
- a directory containing any number of files, e.g. `src/foo`
- any of the above without the leading `src/` or with a leading `./`
- any of the above with an absolute path to `src/`
- any of the above but with Gro as the root directory

The input path API lets the caller customize the allowable extensions.
That means that the caller can look for `.test.` files but not `.gen.`,
or both, or neither, depending on its needs.

In the future we may want to support globbing or regexps.

*/
export const resolveRawInputPath = (
	rawInputPath: string,
	paths?: Paths,
): string => {
	if (isAbsolute(rawInputPath)) return rawInputPath;
	const basePath = stripStart(
		stripStart(stripRelativePath(rawInputPath), SOURCE_DIR),
		SOURCE_DIR_NAME,
	);
	return basePathToSourceId(basePath, paths);
};

export const resolveRawInputPaths = (rawInputPaths: string[]): string[] =>
	(rawInputPaths.length ? rawInputPaths : ['./']).map(p =>
		resolveRawInputPath(p),
	);

/*

Gets a list of possible source ids for each input path with `extensions`,
duplicating each under `rootDirs`.
This is first used to fall back to the Gro dir to search for tasks.
It's the helper used in implementations of `getPossibleSourceIdsForInputPath` below.

*/
export const getPossibleSourceIds = (
	inputPath: string,
	extensions: string[],
	rootDirs: string[] = [],
	paths?: Paths,
): string[] => {
	const possibleSourceIds = [inputPath];
	if (!inputPath.endsWith(sep)) {
		for (const extension of extensions) {
			if (!inputPath.endsWith(extension)) {
				possibleSourceIds.push(inputPath + extension);
			}
		}
	}
	if (rootDirs.length) {
		const ids = possibleSourceIds.slice(); // make a copy or infinitely loop!
		for (const rootDir of rootDirs) {
			if (inputPath.startsWith(rootDir)) continue; // avoid duplicates
			for (const possibleSourceId of ids) {
				possibleSourceIds.push(
					replaceRootDir(possibleSourceId, rootDir, paths),
				);
			}
		}
	}
	return possibleSourceIds;
};

/*

Gets the path data for each input path,
searching for the possibilities based on `extensions`
and stopping at the first match.
Parameterized by `pathExists` and `stat` so it's fs-agnostic.

*/
export const loadSourcePathDataByInputPath = async (
	inputPaths: string[],
	pathExists: (path: string) => Promise<boolean>,
	stat: (path: string | Buffer) => Promise<PathStats>,
	getPossibleSourceIdsForInputPath?: (inputPath: string) => string[],
): Promise<{
	sourceIdPathDataByInputPath: Map<string, PathData>;
	unmappedInputPaths: string[];
}> => {
	const sourceIdPathDataByInputPath = new Map<string, PathData>();
	const unmappedInputPaths: string[] = [];
	for (const inputPath of inputPaths) {
		let filePathData: PathData | null = null;
		let dirPathData: PathData | null = null;
		const possibleSourceIds = getPossibleSourceIdsForInputPath
			? getPossibleSourceIdsForInputPath(inputPath)
			: [inputPath];
		for (const possibleSourceId of possibleSourceIds) {
			if (!(await pathExists(possibleSourceId))) continue;
			const stats = await stat(possibleSourceId);
			if (stats.isDirectory()) {
				if (!dirPathData) {
					dirPathData = toPathData(possibleSourceId, stats);
				}
			} else {
				filePathData = toPathData(possibleSourceId, stats);
				break;
			}
		}
		if (filePathData || dirPathData) {
			sourceIdPathDataByInputPath.set(inputPath, filePathData || dirPathData!); // the ! is needed because TypeScript inference fails
		} else {
			unmappedInputPaths.push(inputPath);
		}
	}
	return {sourceIdPathDataByInputPath, unmappedInputPaths};
};

/*

Finds all of the matching files for the given input paths.
Parameterized by `findFiles` so it's fs-agnostic.
De-dupes source ids.

*/
export const loadSourceIdsByInputPath = async (
	sourceIdPathDataByInputPath: Map<string, PathData>,
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
): Promise<{
	sourceIdsByInputPath: Map<string, string[]>;
	inputDirectoriesWithNoFiles: string[];
}> => {
	const sourceIdsByInputPath = new Map<string, string[]>();
	const inputDirectoriesWithNoFiles: string[] = [];
	const existingSourceIds = new Set<string>();
	for (const [inputPath, pathData] of sourceIdPathDataByInputPath) {
		if (pathData.isDirectory) {
			const files = await findFiles(pathData.id);
			if (files.size) {
				let sourceIds: string[] = [];
				let hasFiles = false;
				for (const [path, stats] of files) {
					if (!stats.isDirectory()) {
						hasFiles = true;
						const sourceId = join(pathData.id, path);
						if (!existingSourceIds.has(sourceId)) {
							existingSourceIds.add(sourceId);
							sourceIds.push(sourceId);
						}
					}
				}
				if (sourceIds.length) {
					sourceIdsByInputPath.set(inputPath, sourceIds);
				}
				if (!hasFiles) {
					inputDirectoriesWithNoFiles.push(inputPath);
				}
				// do callers ever need `inputDirectoriesWithDuplicateFiles`?
			} else {
				inputDirectoriesWithNoFiles.push(inputPath);
			}
		} else {
			if (!existingSourceIds.has(pathData.id)) {
				existingSourceIds.add(pathData.id);
				sourceIdsByInputPath.set(inputPath, [pathData.id]);
			}
		}
	}
	return {sourceIdsByInputPath, inputDirectoriesWithNoFiles};
};
