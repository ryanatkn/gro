import {resolve} from 'path';

import {pathExists} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {createBuild} from './project/build.js';

const DEFAULT_OUTPUT_DIR = 'dist/';
const DEFAULT_INPUT_NAMES = ['src/index.ts'];

export const task: Task = {
	description: 'build the project',
	run: async ({log, args}): Promise<void> => {
		const inputFiles = await resolveInputFiles(args._);
		log.info('inputFiles', inputFiles);

		// TODO what's the best way to define these types? make `Task` generic? schema validation?
		const dev: boolean = 'dev' in args ? !!args.dev : process.env.NODE_ENV !== 'production';
		const watch: boolean = (args.watch as any) || false;
		const outputDir: string = (args.outputDir as any) || DEFAULT_OUTPUT_DIR;
		const mapInputOptions = args.mapInputOptions as any;
		const mapOutputOptions = args.mapOutputOptions as any;
		const mapWatchOptions = args.mapWatchOptions as any;

		if (inputFiles.length) {
			const build = createBuild({
				dev,
				inputFiles,
				outputDir,
				watch,
				mapInputOptions,
				mapOutputOptions,
				mapWatchOptions,
			});
			await build.promise;
		} else {
			log.warn('no input files to build');
		}

		// ...
	},
};

// TODO use `resolveRawInputPaths`? consider the virtual fs
const resolveInputFiles = async (fileNames: string[]): Promise<string[]> => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		for (const name of DEFAULT_INPUT_NAMES) {
			const path = resolve(name);
			if (await pathExists(path)) {
				fileNames = [name];
				break;
			}
		}
	}
	const inputFiles = fileNames.map((f) => resolve(f));
	for (const file of inputFiles) {
		if (!(await pathExists(file))) {
			throw Error(`Input file not found: ${file}`);
		}
	}
	return inputFiles;
};
