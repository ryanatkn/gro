import {resolve, join} from 'path';
import {existsSync} from 'fs';
import {blue} from 'kleur';

import {build} from '../../project/build/build';
import {logger, LogLevel} from '../../project/logger';

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 8999;
const DEFAULT_INPUT_NAME = 'index.ts';

// TODO LogLevel from env vars and cli args
const log = logger(LogLevel.Trace, [blue('[bin/actions/dev]')]);
const {info} = log;

export interface DevActionOpts {
	_: string[];
	host?: string;
	port?: number;
	dir?: string;
	out?: string;
	watch?: boolean;
}

export const run = async (opts: DevActionOpts): Promise<void> => {
	info('opts', opts);
	const host = opts.host || DEFAULT_HOST;
	const port = opts.port || DEFAULT_PORT;
	const dir = resolve(opts.dir || '.');
	const outputDir = opts.out ? resolve(opts.out) : dir;
	const watch = opts.watch || false;
	const inputFiles = resolveInputFiles(dir, opts._);
	info('dir', dir);
	info('inputFiles', inputFiles);
	info('outputDir', outputDir);

	if (inputFiles.length) {
		build({
			dev: process.env.NODE_ENV !== 'production',
			inputFiles,
			outputDir,
			watch,
			host,
			port,
			// logLevel: LogLevel;
		});
	}
};

const resolveInputFiles = (dir: string, fileNames: string[]): string[] => {
	// if no file names are provided, add a default if it exists
	if (!fileNames.length) {
		console.log('NONE', join(dir, DEFAULT_INPUT_NAME));
		if (existsSync(join(dir, DEFAULT_INPUT_NAME))) {
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
