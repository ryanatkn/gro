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
	outputDir: string;
	watch: boolean;
	production: boolean;
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
const DEFAULT_OUTPUT_DIR = 'dist/';
const DEFAULT_INPUT_NAMES = ['src/index.ts'];
export const initOptions = (opts: InitialOptions): Options => {
	return {
		watch: false,
		production: process.env.NODE_ENV === 'production',
		...omitUndefined(opts),
		outputDir: fp.resolve(opts.outputDir || DEFAULT_OUTPUT_DIR),
	};
};

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_, outputDir, watch, production} = options;
	const inputFiles = resolveInputFiles(_);
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

const resolveInputFiles = (fileNames: string[]): string[] => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		for (const name of DEFAULT_INPUT_NAMES) {
			const path = fp.resolve(name);
			if (fs.existsSync(path)) {
				fileNames = [name];
				break;
			}
		}
	}
	const inputFiles = fileNames.map(f => fp.resolve(f));
	for (const file of inputFiles) {
		if (!fs.existsSync(file)) {
			throw Error(`Input file not found: ${file}`);
		}
	}
	return inputFiles;
};
