import fs from 'fs-extra';
import {join} from 'path';
import CheapWatch from 'cheap-watch';

import {LogLevel, logger} from '../utils/log.js';
import {magenta, gray} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {FileStats} from '../project/fileData.js';
import {
	CheapWatchPathAddedEvent,
	CheapWatchPathRemovedEvent,
	DEBOUNCE_DEFAULT,
} from '../project/watch.js';
import {fmtPath} from '../utils/fmt.js';
import {
	GenHost,
	GEN_FILE_PATTERN,
	validateGenModule,
	GenModuleMeta,
} from './gen.js';
import {toBuildId, toSourceId} from '../paths.js';

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const createNodeGenHost = (opts: InitialOptions): GenHost => {
	const {logLevel} = initOptions(opts);
	const {info, trace} = logger(logLevel, [magenta('[gen]')]);

	return {
		//TODO should usage of GEN_FILE_PATTERN be a helper?
		loadModules: async dir => {
			const modules: GenModuleMeta[] = [];

			const buildDir = toBuildId(dir);

			// TODO refactor to use the same file & watch solution as  `NodeTestContext` and `project/assets.ts`
			const filter: (p: {path: string; stats: FileStats}) => boolean = ({
				path,
				stats,
			}) =>
				stats.isDirectory() ||
				(path.includes(GEN_FILE_PATTERN) && path.endsWith('.js')); // excludes sourcemap and other meta files
			const watch = false;
			const debounce = DEBOUNCE_DEFAULT;
			const watcher = new CheapWatch({dir: buildDir, filter, watch, debounce});
			const handlePathAdded = ({
				path,
				stats,
				isNew,
			}: CheapWatchPathAddedEvent) => {
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
			for (const [path, stats] of watcher.paths) {
				if (stats.isDirectory()) continue;
				info('gen', fmtPath(path));
				const buildId = join(buildDir, path);
				const sourceId = toSourceId(buildId);
				const mod = await import(buildId);
				if (!validateGenModule(mod)) {
					throw Error(`Invalid gen module: ${buildId}`);
				}
				modules.push({id: sourceId, mod});
			}

			// clean up - we're not using CheapWatch for its watching! weird I know
			watcher.close();
			watcher.removeAllListeners();

			return modules;
		},
		outputFile: async file => {
			info(
				'writing',
				fmtPath(file.id),
				'generated from',
				fmtPath(file.originId),
			);
			await fs.outputFile(file.id, file.contents);
		},
	};
};
