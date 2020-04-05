import fs from 'fs-extra';
import * as fp from 'path';
import CheapWatch from 'cheap-watch';

import {LogLevel, logger, Logger} from '../utils/log.js';
import {magenta, gray} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {FileStats} from './fileData.js';
import {
	CheapWatchPathAddedEvent,
	CheapWatchPathRemovedEvent,
	DEBOUNCE_DEFAULT,
} from './watch.js';
import {
	GenModule,
	GenContext,
	toGenResult,
	GenResult,
	GEN_FILE_PATTERN,
} from '../gen/gen.js';
import {paths, toSourceId} from '../paths.js';
import {fmtPath} from '../utils/fmt.js';

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

// TODO maybe make this `createGen` so it can be used with `gen` CLI as well as compose with `build`?
export const gen = async (opts: InitialOptions = {}) => {
	const options = initOptions(opts);
	const {logLevel} = options;
	const log = logger(logLevel, [magenta('[gen]')]);
	const {info, trace} = log;

	// TODO refactor to use the same file & watch solution as  `NodeTestContext` and `project/assets.ts`
	const dir = paths.build;
	const filter: (p: {path: string; stats: FileStats}) => boolean = ({
		path,
		stats,
	}) =>
		stats.isDirectory() ||
		(path.includes(GEN_FILE_PATTERN) && path.endsWith('.js')); // excludes sourcemap and other meta files
	const watch = false;
	const debounce = DEBOUNCE_DEFAULT;
	const watcher = new CheapWatch({dir, filter, watch, debounce});
	const handlePathAdded = ({path, stats, isNew}: CheapWatchPathAddedEvent) => {
		trace('added', gray(path), {stats, isNew});
		throw Error('watch is not yet implemented');
	};
	const handlePathRemoved = ({path, stats}: CheapWatchPathRemovedEvent) => {
		trace('removed', gray(path), {stats});
		throw Error('watch is not yet implemented');
	};
	watcher.on('+', handlePathAdded);
	watcher.on('-', handlePathRemoved);

	await watcher.init();
	const genCtx: GenContext = {};
	for (const [path, stats] of watcher.paths) {
		if (stats.isDirectory()) continue;
		info('gen', fmtPath(path));
		const buildId = fp.join(dir, path);
		const mod: GenModule = await import(buildId);
		const rawGenResult = await mod.gen(genCtx);
		const sourceId = toSourceId(buildId);
		const result = toGenResult(sourceId, rawGenResult);
		await writeGenResult(result, log);
	}

	info('gen!');
};

const writeGenResult = async (
	result: GenResult,
	{info}: Logger,
): Promise<void> => {
	const {originFileId, files} = result;

	// TODO max concurrency?
	await Promise.all(
		files.map(file => {
			info(
				'writing',
				fmtPath(file.id),
				'generated from',
				fmtPath(originFileId),
			);
			return fs.outputFile(file.id, file.contents, 'utf8');
		}),
	);
};
