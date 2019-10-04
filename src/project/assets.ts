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
import {paths, toDistId} from '../paths.js';
import {fmtPath} from '../utils/fmt.js';

// TODO needs major refactoring
// - how does it work with the build process instead of as a standalone script?
// - how should imported assets be handled?

export const ASSET_FILE_MATCHER = /.+\.(jpg|png)/;

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const assets = async (opts: InitialOptions = {}) => {
	const options = initOptions(opts);
	const {logLevel} = options;
	const log = logger(logLevel, [magenta('[assets]')]);
	const {info, trace} = log;

	// TODO refactor to use the same file & watch solution as  `NodeTestContext` and `project/gen.ts`
	const dir = paths.source;
	const filter: (p: {path: string; stats: FileStats}) => boolean = ({
		path,
		stats,
	}) => stats.isDirectory() || ASSET_FILE_MATCHER.test(path);
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
	const promises = [];
	for (const [path, stats] of watcher.paths) {
		if (stats.isDirectory()) continue;
		const sourceId = fp.join(dir, path);
		promises.push(copyAssetToDist(sourceId, log));
	}
	await Promise.all(promises);

	info('assets copied!');
};

const copyAssetToDist = async (
	sourceId: string,
	{info}: Logger,
): Promise<void> => {
	const distId = toDistId(sourceId);
	info('copying asset', fmtPath(sourceId), 'to', fmtPath(distId));
	return fs.copy(sourceId, distId);
};
