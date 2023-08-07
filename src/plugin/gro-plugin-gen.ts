import {spawn} from '@feltjs/util/process.js';

import type {FilerEvents} from '../build/Filer.js';
import type {Plugin, PluginContext} from './plugin.js';
import type {Args} from '../utils/args.js';
import {sourceIdToBasePath} from '../paths.js';
import {isGenPath} from '../gen/genModule.js';
import {filterDependents} from '../build/sourceFile.js';
import {GEN_NO_PROD_MESSAGE} from '../gen/runGen.js';
import {throttleAsync} from '../utils/throttleAsync.js';

const name = '@feltjs/gro-plugin-gen';

const FLUSH_DEBOUNCE_DELAY = 500;

export interface TaskArgs extends Args {
	watch?: boolean;
}

export const createPlugin = (): Plugin<PluginContext<TaskArgs, object>> => {
	let generating = false;
	let regen = false;
	let onFilerBuild: ((e: FilerEvents['build']) => void) | undefined;
	const queuedFiles: Set<string> = new Set();
	const queueGen = (genFileName: string) => {
		queuedFiles.add(genFileName);
		void flushGenQueue();
	};
	const flushGenQueue = throttleAsync(
		async () => {
			// hacky way to avoid concurrent `gro gen` calls
			if (generating) {
				regen = true;
				return;
			}
			generating = true;
			const files = Array.from(queuedFiles);
			queuedFiles.clear();
			await gen(files);
			generating = false;
			if (regen) {
				regen = false;
				void flushGenQueue();
			}
		},
		undefined,
		FLUSH_DEBOUNCE_DELAY,
	);
	const gen = (files: string[] = []) => spawn('npx', ['gro', 'gen', '--no-rebuild', ...files]);
	return {
		name,
		setup: async ({filer, args: {watch}, dev, log}) => {
			if (!dev) throw Error(GEN_NO_PROD_MESSAGE);

			// Do we need to just generate everything once and exit?
			if (!filer || !watch) {
				log.info('generating and exiting early');
				await gen();
				return;
			}

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			onFilerBuild = async ({sourceFile, buildConfig}) => {
				console.log(`build sourceFile`, sourceFile.id, sourceFile.dir);
				if (buildConfig.name !== 'system') return;
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
			filer.on('build', onFilerBuild);
		},
		teardown: async ({filer}) => {
			if (onFilerBuild && filer) {
				filer.off('build', onFilerBuild);
			}
		},
	};
};
