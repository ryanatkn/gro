import {spawn} from '@feltcoop/felt/util/process.js';
import type {FilerEvents} from 'src/build/Filer.js';

import type {Plugin, PluginContext} from 'src/plugin/plugin.js';
import type {Args} from 'src/task/task.js';

const name = '@feltcoop/groPluginGen';

export interface TaskArgs extends Args {
	insecure?: boolean;
	cert?: string;
	certkey?: string;
	watch?: boolean;
}

export const createPlugin = (): Plugin<PluginContext<TaskArgs, {}>> => {
	let listener: (e: FilerEvents['build']) => void;
	const queuedFiles: Set<string> = new Set();
	const queueGen = (genFileNames: string) => {
		queuedFiles.add(genFileNames);
		flushGenQueue();
	};
	const flushGenQueue = async () => {
		const files = Array.from(queuedFiles);
		queuedFiles.clear();
		await spawn('npx', ['gro', 'gen', ...files]);
	};
	return {
		name,
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		// TODO wip - this isn't really implemented yet
		setup: async (ctx) => {
			const {filer} = ctx;
			if (!filer) throw Error(`${name} expects a filer arg`);

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
			ctx.filer!.off('build', listener);
		},
	};
};
