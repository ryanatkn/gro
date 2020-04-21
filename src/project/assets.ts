import fs from 'fs-extra';
import CheapWatch from 'cheap-watch';

import {SystemLogger, Logger} from '../utils/log.js';
import {magenta, gray} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {FileStats} from '../files/fileData.js';
import {
	CheapWatchPathAddedEvent,
	CheapWatchPathRemovedEvent,
	DEBOUNCE_DEFAULT,
} from '../files/nodeFs.js';
import {
	paths,
	toDistId,
	SOURCE_DIR_NAME,
	BUILD_DIR_NAME,
	SOURCE_DIR,
	BUILD_DIR,
} from '../paths.js';
import {fmtPath} from '../utils/fmt.js';

// TODO needs major refactoring
// - how does it work with the build process instead of as a standalone script?
// - how should imported assets be handled?

export const DEFAULT_ASSET_MATCHER = /\.(jpg|png|ico|html)$/;

export interface Options {
	isAsset: (path: string) => boolean;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	isAsset: path => DEFAULT_ASSET_MATCHER.test(path),
	...omitUndefined(opts),
});

export const assets = async (opts: InitialOptions = {}) => {
	const options = initOptions(opts);
	const {isAsset} = options;
	const log = new SystemLogger([magenta('[assets]')]);
	const {info, trace} = log;

	// TODO refactor to use the same file & watch solution as  `NodeTestContext` and `project/gen.ts`
	const dir = paths.root;
	const filter: (p: {path: string; stats: FileStats}) => boolean = ({
		path,
		stats,
	}) => {
		// TODO maybe make regexps for these?
		const shouldWatch = stats.isDirectory()
			? path.startsWith(SOURCE_DIR) ||
			  path.startsWith(BUILD_DIR) ||
			  path === SOURCE_DIR_NAME ||
			  path === BUILD_DIR_NAME
			: isAsset(path) &&
			  (path.startsWith(SOURCE_DIR) || path.startsWith(BUILD_DIR));
		trace('watch path?', path, shouldWatch);
		return shouldWatch;
	};
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
		const id = dir + path;
		promises.push(copyAssetToDist(id, log));
	}
	await Promise.all(promises);

	info('assets copied!');
};

const copyAssetToDist = async (id: string, {info}: Logger): Promise<void> => {
	const distId = toDistId(id);
	info('copying asset', fmtPath(id), 'to', fmtPath(distId));
	return fs.copy(id, distId);
};
