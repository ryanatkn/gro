import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {blue} from 'kleur';

import {createBuild} from '../../project/build/build';
import {logger, LogLevel} from '../../project/logger';
import {createDevServer} from '../../devServer/devServer';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue('[bin/actions/dev]')]);
const {info} = log;

export interface DevActionOptions {
	_: string[];
	host: string;
	port: number;
	dir: string;
	outputDir: string;
	watch: boolean;
}
export type RequiredDevActionOptions = '_';
export type InitialDevActionOptions = PartialExcept<
	DevActionOptions,
	RequiredDevActionOptions
>;
const DEFAULT_HOST = '0.0.0.0'; // 'localhost'; why is 0.0.0.0 needed here but not for sirv?
const DEFAULT_PORT = 8999;
const DEFAULT_INPUT_NAME = 'index.ts';
export const defaultDevActionOptions = (
	opts: InitialDevActionOptions,
): DevActionOptions => {
	const dir = resolve(opts.dir || '.');
	return {
		host: DEFAULT_HOST,
		port: DEFAULT_PORT,
		watch: false,
		...opts,
		dir,
		outputDir: opts.outputDir ? resolve(opts.outputDir) : dir,
	};
};

export const run = async (opts: InitialDevActionOptions): Promise<void> => {
	info('opts', opts);
	const options = defaultDevActionOptions(opts);
	const {_, host, port, dir, outputDir, watch} = options;
	info('dir', dir);
	const inputFiles = resolveInputFiles(dir, _);
	info('inputFiles', inputFiles);
	info('outputDir', outputDir);

	const devServer = createDevServer({host, port, dir});
	info(`serving ${dir} on ${host}:${port}`);
	await devServer.start();

	if (inputFiles.length) {
		const build = createBuild({
			dev: process.env.NODE_ENV !== 'production',
			inputFiles,
			outputDir,
			watch,
			host,
			port,
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
