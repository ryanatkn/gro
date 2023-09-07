import {join, isAbsolute, basename} from 'node:path';
import {stripEnd, stripStart} from '@feltjs/util/string.js';

import {
	base_path_to_source_id,
	replace_root_dir,
	gro_dir_basename,
	gro_paths,
	type Paths,
	LIB_DIR,
	LIB_PATH,
	LIB_DIRNAME,
} from './paths.js';
import {toPathData, type PathData, type PathStats} from './pathData.js';
import type {Filesystem} from '../fs/filesystem.js';

/**
 * Raw input paths are paths that users provide to Gro to reference files
 * enhanced with Gro's conventions like `.test.`, `.task.`, and `.gen.`.
 *
 * A raw input path can be:
 *
 * - a relative path to a file, e.g. `src/foo/bar.test.ts`
 * - a file without an extension, e.g. `src/foo/bar` if `extensions` is `.test.ts`
 * - a directory containing any number of files, e.g. `src/foo`
 * - any of the above without the leading `src/` or with a leading `./`
 * - any of the above but leading with `gro/` to ignore the local directory
 * - an absolute path to a file or directory in the current directory or Gro's
 *
 * The input path API lets the caller customize the allowable extensions.
 * That means that the caller can look for `.test.` files but not `.gen.`,
 * or both, or neither, depending on its needs.
 *
 * In the future we may want to support globbing or regexps.
 */
export const resolveRawInputPath = (rawInputPath: string, fromPaths?: Paths): string => {
	if (isAbsolute(rawInputPath)) return stripEnd(rawInputPath, '/');
	// Allow prefix `./` and just remove it if it's there.
	let base_path = stripEnd(stripStart(rawInputPath, './'), '/');
	let paths = fromPaths;
	if (!paths) {
		// If it's prefixed with `gro/` or exactly `gro`, use the Gro paths.
		if (base_path.startsWith(gro_dir_basename)) {
			paths = gro_paths;
			base_path = stripStart(base_path, gro_dir_basename);
		} else if (base_path + '/' === gro_dir_basename) {
			paths = gro_paths;
			base_path = '';
		}
	}
	// Handle `src/lib` by itself without conflicting with `src/libFoo` names.
	if (base_path === LIB_PATH) base_path = '';
	// Allow prefix `src/lib/` and just remove it if it's there.
	base_path = stripStart(base_path, LIB_DIR);
	return base_path_to_source_id(LIB_DIRNAME + '/' + base_path, paths);
};

export const resolveRawInputPaths = (rawInputPaths: string[]): string[] =>
	(rawInputPaths.length ? rawInputPaths : ['./']).map((p) => resolveRawInputPath(p));

/**
 * Gets a list of possible source ids for each input path with `extensions`,
 * duplicating each under `rootDirs`.
 * This is first used to fall back to the Gro dir to search for tasks.
 * It's the helper used in implementations of `getPossibleSourceIdsForInputPath` below.
 */
export const getPossibleSourceIds = (
	inputPath: string,
	extensions: string[],
	rootDirs?: string[],
	paths?: Paths,
): string[] => {
	const possibleSourceIds = [inputPath];
	if (!inputPath.endsWith('/')) {
		for (const extension of extensions) {
			if (!inputPath.endsWith(extension)) {
				possibleSourceIds.push(inputPath + extension);
				// Support task directories, so `src/a/a.task.ts` works like `src/a.task.ts`.
				possibleSourceIds.push(inputPath + '/' + basename(inputPath) + extension);
			}
		}
	}
	if (rootDirs?.length) {
		const ids = possibleSourceIds.slice(); // make a copy or infinitely loop!
		for (const rootDir of rootDirs) {
			if (inputPath.startsWith(rootDir)) continue; // avoid duplicates
			for (const possibleSourceId of ids) {
				possibleSourceIds.push(replace_root_dir(possibleSourceId, rootDir, paths));
			}
		}
	}
	return possibleSourceIds;
};

/**
 * Gets the path data for each input path,
 * searching for the possibilities based on `extensions`
 * and stopping at the first match.
 * Parameterized by `exists` and `stat` so it's fs-agnostic.
 */
export const loadSourcePathDataByInputPath = async (
	fs: Filesystem,
	inputPaths: string[],
	getPossibleSourceIdsForInputPath?: (inputPath: string) => string[],
): Promise<{
	source_idPathDataByInputPath: Map<string, PathData>;
	unmappedInputPaths: string[];
}> => {
	const source_idPathDataByInputPath = new Map<string, PathData>();
	const unmappedInputPaths: string[] = [];
	for (const inputPath of inputPaths) {
		let filePathData: PathData | null = null;
		let dirPathData: PathData | null = null;
		const possibleSourceIds = getPossibleSourceIdsForInputPath
			? getPossibleSourceIdsForInputPath(inputPath)
			: [inputPath];
		for (const possibleSourceId of possibleSourceIds) {
			if (!(await fs.exists(possibleSourceId))) continue; // eslint-disable-line no-await-in-loop
			const stats = await fs.stat(possibleSourceId); // eslint-disable-line no-await-in-loop
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
			source_idPathDataByInputPath.set(inputPath, filePathData || dirPathData!); // the ! is needed because TypeScript inference fails
		} else {
			unmappedInputPaths.push(inputPath);
		}
	}
	return {source_idPathDataByInputPath, unmappedInputPaths};
};

/**
 * Finds all of the matching files for the given input paths.
 * Parameterized by `findFiles` so it's fs-agnostic.
 * De-dupes source ids.
 */
export const loadSourceIdsByInputPath = async (
	source_idPathDataByInputPath: Map<string, PathData>,
	findFiles: (id: string) => Promise<Map<string, PathStats>>,
): Promise<{
	source_idsByInputPath: Map<string, string[]>;
	inputDirectoriesWithNoFiles: string[];
}> => {
	const source_idsByInputPath = new Map<string, string[]>();
	const inputDirectoriesWithNoFiles: string[] = [];
	const existingSourceIds = new Set<string>();
	for (const [inputPath, pathData] of source_idPathDataByInputPath) {
		const {id} = pathData;
		if (pathData.isDirectory) {
			const files = await findFiles(id); // eslint-disable-line no-await-in-loop
			if (files.size) {
				const source_ids: string[] = [];
				let hasFiles = false;
				for (const path of files.keys()) {
					hasFiles = true;
					const source_id = join(id, path);
					if (!existingSourceIds.has(source_id)) {
						existingSourceIds.add(source_id);
						source_ids.push(source_id);
					}
				}
				if (source_ids.length) {
					source_idsByInputPath.set(inputPath, source_ids);
				}
				if (!hasFiles) {
					inputDirectoriesWithNoFiles.push(inputPath);
				}
				// do callers ever need `inputDirectoriesWithDuplicateFiles`?
			} else {
				inputDirectoriesWithNoFiles.push(inputPath);
			}
		} else if (!existingSourceIds.has(id)) {
			existingSourceIds.add(id);
			source_idsByInputPath.set(inputPath, [id]);
		}
	}
	return {source_idsByInputPath, inputDirectoriesWithNoFiles};
};
