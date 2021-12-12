import {spawn} from '@feltcoop/felt/util/process.js';
import {debounce} from 'throttle-debounce';

import type {FilerEvents} from 'src/build/Filer.js';
import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';
import {sourceIdToBasePath} from '../paths.js';
import {isGenPath} from '../gen/gen.js';
import type {SourceFile} from 'src/build/sourceFile.js';
import type {IdFilter} from 'src/fs/filter.js';
import type {BuildConfig} from 'src/index.js';

const name = '@feltcoop/groPluginGen';

const FLUSH_DEBOUNCE_DELAY = 500; // TODO name?

export interface TaskArgs extends Args {
	watch?: boolean;
}

export const createPlugin = (): Plugin<PluginContext<TaskArgs, {}>> => {
	let onBuild: ((e: FilerEvents['build']) => void) | undefined;
	const queuedFiles: Set<string> = new Set();
	const queueGen = (genFileName: string) => {
		console.log('queue genFileName', genFileName);
		queuedFiles.add(genFileName);
		flushGenQueue();
	};
	const flushGenQueue = debounce(FLUSH_DEBOUNCE_DELAY, async () => {
		console.log('flushGenQueue!!!!!!!!!!!!!!!!!!!');
		const files = Array.from(queuedFiles);
		queuedFiles.clear();
		await gen(files);
	});
	const gen = (files: string[]) => spawn('npx', ['gro', 'gen', ...files]);
	return {
		name,
		setup: async (ctx) => {
			const {
				filer,
				args: {watch},
			} = ctx;
			if (!filer) throw Error(`${name} expects a filer arg`);
			if (!watch) {
				return flushGenQueue(); // TODO how should this work?
			}

			onBuild = async ({sourceFile, buildConfig}) => {
				console.log('onBuild sourceFile', sourceFile.id);
				// TODO needs to handle if the sourceFile.id itself matches the filter,
				// at the moment it only checks the dependents
				// if (isGenPath(sourceFile.id))
				const genFileDependents = filterDependents(
					sourceFile,
					buildConfig,
					filer.findById as any,
					isGenPath,
				); // TODO see `filterDependents` for more about the type cast
				for (const genFileDependent of genFileDependents) {
					queueGen(sourceIdToBasePath(genFileDependent));
				}
			};
			filer.on('build', onBuild);
		},
		teardown: async (ctx) => {
			if (onBuild) ctx.filer!.off('build', onBuild);
		},
	};
};

// TODO move this
const filterDependents = (
	sourceFile: SourceFile,
	buildConfig: BuildConfig,
	findFileById: (id: string) => SourceFile | undefined, // TODO SourceFile vs BaseFilerFile
	filter: IdFilter,
	// TODO return string id or SourceFile?
	results: Set<string> = new Set(), // TODO strings only? set?
	searched: Set<string> = new Set(),
): Set<string> => {
	const dependentsForConfig = sourceFile.dependents?.get(buildConfig);
	if (!dependentsForConfig) return results;
	console.log('buildConfig.name', buildConfig.name);
	for (const dependentId of dependentsForConfig.keys()) {
		if (searched.has(dependentId)) continue;
		searched.add(dependentId);
		console.log('searched dependentId', dependentId);
		const dependentSourceFile = findFileById(dependentId)!;
		if (filter(dependentId)) {
			results.add(dependentId);
		}
		filterDependents(dependentSourceFile, buildConfig, findFileById, filter, results, searched);
		// TODO search each of
	}
	return results;
};
