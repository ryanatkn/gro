import {resolve} from 'path';
import {existsSync} from 'fs';

import {blue, magenta} from '../colors/terminal.js';
import {createBuild} from '../project/build.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';

const {info, warn} = new SystemLogger([blue(`[commands/${magenta('build')}]`)]);

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
		outputDir: resolve(opts.outputDir || DEFAULT_OUTPUT_DIR),
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
