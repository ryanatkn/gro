import {spawn} from '@feltcoop/felt/util/process.js';
import type {FilerEvents} from 'src/build/Filer.js';

import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';

const name = '@feltcoop/groPluginGen';

export interface TaskArgs extends Args {
	watch?: boolean;
}

// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
// TODO wip - this isn't implemented yet
export const createPlugin = (): Plugin<PluginContext<TaskArgs, {}>> => {
	let listener: ((e: FilerEvents['build']) => void) | undefined;
	const queuedFiles: Set<string> = new Set();
	const queueGen = (genFileNames: string) => {
		queuedFiles.add(genFileNames);
		flushGenQueue();
	};
	const flushGenQueue = async () => {
		const files = Array.from(queuedFiles);
		queuedFiles.clear();
		await gen(files);
	};
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
				return flushGenQueue();
			}

			listener = async ({buildConfig, sourceFile}) => {
				console.log('sourceFile, buildConfig', sourceFile.id, buildConfig.name);
				const genFileNames = 'tasks.gen.md.ts'; // TODO
				// TODO debounce
				if (genFileNames) {
					queueGen(genFileNames);
				}
			};
			filer.on('build', listener);
		},
		teardown: async (ctx) => {
			if (listener) ctx.filer!.off('build', listener);
		},
	};
};
