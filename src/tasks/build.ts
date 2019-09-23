import * as fp from 'path';
import fs from 'fs-extra';

import {blue, magenta} from '../colors/terminal.js';
import {createBuild} from '../project/build.js';
import {logger, LogLevel} from '../utils/logUtils.js';
import {omitUndefined} from '../utils/objectUtils.js';

// TODO get LogLevel from env vars and cli args - make it an option
const logLevel = LogLevel.Trace;

const log = logger(logLevel, [blue(`[tasks/${magenta('build')}]`)]);
const {info, warn} = log;

export interface Options {
	_: string[];
	dir: string;
	outputDir: string;
	watch: boolean;
	production: boolean;
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_INPUT_NAMES = ['index.ts', 'src/index.ts'];
export const initOptions = (opts: InitialOptions): Options => {
	const dir = fp.resolve(opts.dir || '.');
	return {
		watch: false,
		production: process.env.NODE_ENV === 'production',
		...omitUndefined(opts),
		dir,
		outputDir: opts.outputDir ? fp.resolve(opts.outputDir) : dir,
	};
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_, dir, outputDir, watch, production} = options;
	const inputFiles = resolveInputFiles(dir, _);
	info('inputFiles', inputFiles);

	if (inputFiles.length) {
		const build = createBuild({
			dev: !production,
			inputFiles,
			outputDir,
			watch,
			logLevel,
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
			const path = fp.join(dir, name);
			if (fs.existsSync(path)) {
				fileNames = [name];
				break;
			}
		}
	}
	const inputFiles = fileNames.map(f => fp.join(dir, f));
	for (const file of inputFiles) {
		if (!fs.existsSync(file)) {
			throw Error(`Input file not found: ${file}`);
		}
	}
	return inputFiles;
};
