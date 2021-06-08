import {gray} from '@feltcoop/felt/utils/terminal.js';

import type {Encoding} from '../fs/encoding.js';
import {JSON_EXTENSION, to_build_out_dirname} from '../paths.js';
import {getFileContentsHash} from './baseFilerFile.js';
import type {BuildDependency, BuildContext} from './builder.js';
import type {BuildableSourceFile} from './sourceFile.js';
import {isExternalBrowserModule} from '../utils/module.js';
import type {Build_Name} from '../build/build_config.js';

export interface SourceMeta {
	readonly cacheId: string; // path to the cached JSON file on disk
	readonly data: SourceMetaData; // the plain JSON written to disk
}

export interface SourceMetaData {
	readonly source_id: string;
	readonly contentsHash: string;
	readonly builds: SourceMetaBuild[];
}

export interface SourceMetaBuild {
	readonly id: string;
	readonly name: Build_Name; // TODO doesn't feel right, maybe rename to `build_name`
	readonly dependencies: BuildDependency[] | null;
	readonly encoding: Encoding;
}

const CACHED_SOURCE_INFO_DIR_SUFFIX = '_meta'; // so `/.gro/dev_meta` is metadata for `/.gro/dev`
export const toSourceMetaDir = (build_dir: string, dev: boolean): string =>
	`${build_dir}${to_build_out_dirname(dev)}${CACHED_SOURCE_INFO_DIR_SUFFIX}`;

// TODO as an optimization, this should be debounced per file,
// because we're writing per build config.
export const updateSourceMeta = async (
	ctx: BuildContext,
	file: BuildableSourceFile,
): Promise<void> => {
	const {fs, sourceMetaById, dev, build_dir} = ctx;
	if (file.build_configs.size === 0) {
		return deleteSourceMeta(ctx, file.id);
	}

	// create the new meta, not mutating the old
	const cacheId = toSourceMetaId(file, build_dir, dev);
	const data: SourceMetaData = {
		source_id: file.id,
		contentsHash: getFileContentsHash(file),
		builds: Array.from(file.buildFiles.values()).flatMap((files) =>
			files.map(
				(file): SourceMetaBuild => ({
					id: file.id,
					name: file.build_config.name,
					dependencies:
						file.dependenciesByBuildId && Array.from(file.dependenciesByBuildId.values()),
					encoding: file.encoding,
				}),
			),
		),
	};
	const sourceMeta: SourceMeta = {cacheId, data};
	// TODO convert this to a test
	// This is useful for debugging, but has false positives
	// when source changes but output doesn't, like if comments get elided.
	// if (
	// 	(await fs.exists(cacheId)) &&
	// 	deepEqual(JSON.parse(await readFile(cacheId, 'utf8')), sourceMeta)
	// ) {
	// 	console.log(
	// 		'wasted build detected! unchanged file was built and identical source meta written to disk: ' +
	// 			cacheId,
	// 	);
	// }

	sourceMetaById.set(file.id, sourceMeta);
	// this.log.trace('outputting source meta', gray(cacheId));
	await fs.writeFile(cacheId, JSON.stringify(data, null, 2));
};

export const deleteSourceMeta = async (
	{fs, sourceMetaById}: BuildContext,
	source_id: string,
): Promise<void> => {
	const meta = sourceMetaById.get(source_id);
	if (meta === undefined) return; // silently do nothing, which is fine because it's a cache
	sourceMetaById.delete(source_id);
	await fs.remove(meta.cacheId);
};

const toSourceMetaId = (file: BuildableSourceFile, build_dir: string, dev: boolean): string =>
	`${toSourceMetaDir(build_dir, dev)}/${file.dir_base_path}${file.filename}${JSON_EXTENSION}`;

export const initSourceMeta = async ({
	fs,
	sourceMetaById,
	build_dir,
	dev,
}: BuildContext): Promise<void> => {
	const sourceMetaDir = toSourceMetaDir(build_dir, dev);
	if (!(await fs.exists(sourceMetaDir))) return;
	const files = await fs.findFiles(sourceMetaDir, undefined, null);
	await Promise.all(
		Array.from(files.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const cacheId = `${sourceMetaDir}/${path}`;
			const data: SourceMetaData = JSON.parse(await fs.readFile(cacheId, 'utf8'));
			sourceMetaById.set(data.source_id, {cacheId, data});
		}),
	);
};

// Cached source meta may be stale if any source files were moved or deleted
// since the last time the Filer ran.
// We can simply delete any cached meta that doesn't map back to a source file.
export const cleanSourceMeta = async (
	ctx: BuildContext,
	fileExists: (id: string) => boolean,
): Promise<void> => {
	const {sourceMetaById, log} = ctx;
	let promises: Promise<void>[] | null = null;
	for (const source_id of sourceMetaById.keys()) {
		if (!fileExists(source_id) && !isExternalBrowserModule(source_id)) {
			log.trace('deleting unknown source meta', gray(source_id));
			(promises || (promises = [])).push(deleteSourceMeta(ctx, source_id));
		}
	}
	if (promises !== null) await Promise.all(promises);
};
