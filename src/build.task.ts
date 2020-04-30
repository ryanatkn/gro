import {resolve} from 'path';
import {existsSync} from 'fs';

import {Task} from './task/task.js';
import {createBuild} from './project/build.js';

const DEFAULT_OUTPUT_DIR = 'dist/';
const DEFAULT_INPUT_NAMES = ['src/index.ts'];

export const task: Task = {
	description: 'Build the code',
	run: async ({log: {info, warn}, args}): Promise<void> => {
		const inputFiles = resolveInputFiles(args._);
		info('inputFiles', inputFiles);

		const dev: boolean = process.env.NODE_ENV !== 'production';
		const watch: boolean = (args.watch as any) || false;
		const outputDir: string = (args.outputDir as any) || DEFAULT_OUTPUT_DIR;

		if (inputFiles.length) {
			const build = createBuild({
				dev,
				inputFiles,
				outputDir,
				watch,
			});
			await build.promise;
		} else {
			warn('no input files to build');
		}

		// ...
	},
};

// TODO use `resolveRawInputPaths`? consider the virtual fs
const resolveInputFiles = (fileNames: string[]): string[] => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		for (const name of DEFAULT_INPUT_NAMES) {
			const path = resolve(name);
			if (existsSync(path)) {
				fileNames = [name];
				break;
			}
		}
	}
	const inputFiles = fileNames.map(f => resolve(f));
	for (const file of inputFiles) {
		if (!existsSync(file)) {
			throw Error(`Input file not found: ${file}`);
		}
	}
	return inputFiles;
};
