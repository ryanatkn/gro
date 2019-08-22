import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {blue, magenta} from 'kleur';

import {createBuild} from '../../project/build/build';
import {logger, LogLevel} from '../../project/logger';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue(`[bin/actions/${magenta('build')}]`)]);
const {info} = log;

export interface BuildActionOptions {
	_: string[];
	dir: string;
	outputDir: string;
	watch: boolean;
}
export type RequiredBuildActionOptions = '_';
export type InitialBuildActionOptions = PartialExcept<
	BuildActionOptions,
	RequiredBuildActionOptions
>;
const DEFAULT_INPUT_NAME = 'index.ts';
export const defaultBuildActionOptions = (
	opts: InitialBuildActionOptions,
): BuildActionOptions => {
	const dir = resolve(opts.dir || '.');
	return {
		watch: false,
		...opts,
		dir,
		outputDir: opts.outputDir ? resolve(opts.outputDir) : dir,
	};
};

export const run = async (opts: InitialBuildActionOptions): Promise<void> => {
	const options = defaultBuildActionOptions(opts);
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
	}

	// ...
};

const resolveInputFiles = (dir: string, fileNames: string[]): string[] => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		const defaultInputPath = join(dir, DEFAULT_INPUT_NAME);
		if (existsSync(defaultInputPath)) {
			fileNames = [DEFAULT_INPUT_NAME];
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
