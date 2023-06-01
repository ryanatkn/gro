import {spawn} from '@feltjs/util/process.js';
import {debounce} from 'throttle-debounce';

import type {FilerEvents} from '../build/Filer.js';
import type {Plugin, PluginContext} from './plugin.js';
import type {Args} from '../utils/args.js';
import {sourceIdToBasePath} from '../paths.js';
import {isGenPath} from '../gen/genModule.js';
import {filterDependents} from '../build/sourceFile.js';

const name = '@feltjs/gro-plugin-gen';

const FLUSH_DEBOUNCE_DELAY = 500;

export interface TaskArgs extends Args {
	watch?: boolean;
}

export const createPlugin = (): Plugin<PluginContext<TaskArgs, object>> => {
	let generating = false;
	let regen = false;
	let onBuildFile: ((e: FilerEvents['build']) => void) | undefined;
	const queuedFiles: Set<string> = new Set();
	const queueGen = (genFileName: string) => {
		queuedFiles.add(genFileName);
		flushGenQueue();
	};
	const flushGenQueue = debounce(FLUSH_DEBOUNCE_DELAY, async () => {
		// hacky way to avoid concurrent `gro gen` calls
		if (generating) {
			regen = true;
			return;
		}
		generating = true;
		const files = Array.from(queuedFiles);
		queuedFiles.clear();
		await gen(files); // TODO the `flushGenQueue` doesn't wait
		console.log('GENERATED');
		generating = false;
		if (regen) {
			regen = false;
			flushGenQueue();
		}
	});
	const gen = (files: string[]) => spawn('npx', ['gro', 'gen', '--no-rebuild', ...files]);
	return {
		name,
		setup: async (ctx) => {
			const {
				filer,
				args: {watch},
			} = ctx;
			if (!filer) throw Error(`${name} expects a filer arg`);
			if (!watch) {
				await flushGenQueue(); // TODO the `flushGenQueue` doesn't wait
				console.log('FLUSHED');
				return;
			}

			// When a file builds, check it and its tree of dependents
			// for any `.gen.` files that need to run.
			onBuildFile = async ({sourceFile, buildConfig}) => {
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
			filer.on('build', onBuildFile);
		},
		teardown: async (ctx) => {
			if (onBuildFile) ctx.filer!.off('build', onBuildFile);
		},
	};
};
