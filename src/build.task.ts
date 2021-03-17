import {resolve} from 'path';

import {pathExists} from './fs/nodeFs.js';
import {Task} from './task/task.js';
import {createBuild} from './project/build.js';
import {getDefaultEsbuildOptions} from './build/esbuildBuildHelpers.js';
import {loadTsconfig, toEcmaScriptTarget} from './build/tsBuildHelpers.js';

// TODO how should this be done? do we want to allow development builds with Rollup?
process.env.NODE_ENV = 'production';

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

		// TODO this is outdated - needs to be updated with the Gro config (see `dev.task.ts`)
		const tsconfigPath = undefined; // TODO parameterized options?
		const basePath = undefined; // TODO parameterized options?
		const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
		const target = toEcmaScriptTarget(tsconfig.compilerOptions?.target);
		const sourceMap = tsconfig.compilerOptions?.sourceMap ?? process.env.NODE_ENV !== 'production';
		const esbuildOptions = getDefaultEsbuildOptions(target, sourceMap);

		if (inputFiles.length) {
			const build = createBuild({
				dev,
				sourceMap,
				inputFiles,
				outputDir,
				watch,
				mapInputOptions,
				mapOutputOptions,
				mapWatchOptions,
				esbuildOptions,
			});
			await build.promise;
		} else {
			log.warn('no input files to build');
		}

		// ...
	},
};

// TODO use `resolveRawInputPaths`? consider the virtual fs - use the `Filer` probably
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
