import {spawn} from '@feltcoop/felt/util/process.js';
import {debounce} from 'throttle-debounce';

import type {FilerEvents} from 'src/build/Filer.js';
import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';
import {sourceIdToBasePath} from '../paths.js';
import {isGenPath} from '../gen/gen.js';
import {filterDependents} from '../build/sourceFile.js';

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
		// TODO should this block additional `gen` calls until ready?
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

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			onBuild = async ({sourceFile, buildConfig}) => {
				if (isGenPath(sourceFile.id)) {
					queueGen(sourceIdToBasePath(sourceFile.id));
				}
				const dependentGenFileIds = filterDependents(
					sourceFile,
					buildConfig,
					filer.findById as any, // cast because we can assume they're all `SourceFile`s
					isGenPath,
				);
				for (const dependentGenFileId of dependentGenFileIds) {
					queueGen(sourceIdToBasePath(dependentGenFileId));
				}
			};
			filer.on('build', onBuild);
		},
		teardown: async (ctx) => {
			if (onBuild) ctx.filer!.off('build', onBuild);
		},
	};
};
