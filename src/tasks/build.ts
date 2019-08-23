import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {blue, magenta} from 'kleur';

import {createBuild} from '../build/build';
import {logger, LogLevel} from '../utils/logger';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[tasks/${magenta('build')}]`)]);
const {info, warn} = log;

export interface Options {
	_: string[];
	dir: string;
	outputDir: string;
	watch: boolean;
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_INPUT_NAMES = ['index.ts', 'src/index.ts'];
export const initOptions = (opts: InitialOptions): Options => {
	const dir = resolve(opts.dir || '.');
	return {
		watch: false,
		...opts,
		dir,
		outputDir: opts.outputDir ? resolve(opts.outputDir) : dir,
	};
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_, dir, outputDir, watch} = options;
	const inputFiles = resolveInputFiles(dir, _);
	info('inputFiles', inputFiles);

	if (inputFiles.length) {
		const build = createBuild({
			dev: process.env.NODE_ENV !== 'production',
			inputFiles,
			outputDir,
			watch,
			// logLevel: LogLevel;
		});
		await build.promise;
	} else {
		warn('no input files to build');
	}

	// ...
};

const resolveInputFiles = (dir: string, fileNames: string[]): string[] => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		for (const name of DEFAULT_INPUT_NAMES) {
			const path = join(dir, name);
			if (existsSync(path)) {
				fileNames = [name];
				break;
			}
		}
	}
	const inputFiles = fileNames.map(f => join(dir, f));
	for (const file of inputFiles) {
		if (!existsSync(file)) {
			throw Error(`Input file not found: ${file}`);
		}
	}
	return inputFiles;
};
