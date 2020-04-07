import {join} from 'path';
import CheapWatch from 'cheap-watch';

import {LogLevel, logger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {FileStats} from '../project/fileData.js';
import {DEBOUNCE_DEFAULT} from '../project/watch.js';
import {fmtPath} from '../utils/fmt.js';
import {RunHost} from './run.js';
import {
	isTaskPath,
	toTaskName,
	TaskModuleMeta,
	validateTaskModule,
} from './task.js';
import {toSourcePath, toBuildId, toSourceId, toBasePath} from '../paths.js';

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const createNodeRunHost = (opts: InitialOptions): RunHost => {
	const {logLevel} = initOptions(opts);
	const {info, trace} = logger(logLevel, [magenta('[run]')]);

	return {
		findTasks: async (dir: string): Promise<string[]> => {
			info(`finding all tasks in ${fmtPath(dir)}`);
			const sourceIds: string[] = [];

			const buildDir = toBuildId(dir);

			const filter: (p: {path: string; stats: FileStats}) => boolean = ({
				path,
				stats,
			}) => stats.isDirectory() || isTaskPath(path);
			const watch = false;
			const debounce = DEBOUNCE_DEFAULT;
			const watcher = new CheapWatch({dir: buildDir, filter, watch, debounce});

			await watcher.init();
			for (const [path, stats] of watcher.paths) {
				if (stats.isDirectory()) continue;
				const sourceId = toSourceId(join(buildDir, path));
				trace('found task', fmtPath(sourceId));
				sourceIds.push(sourceId);
			}
			watcher.close();
			watcher.removeAllListeners();

			return sourceIds;
		},
		loadTaskModule: async (sourceId: string): Promise<TaskModuleMeta> => {
			trace('loading task', fmtPath(sourceId));
			const buildId = toBuildId(sourceId);
			const mod = await import(buildId);
			if (!validateTaskModule(mod)) {
				throw Error(`Task module export is invalid: ${toSourcePath(buildId)}`);
			}
			return {
				id: sourceId,
				name: toTaskName(toBasePath(buildId)),
				mod,
			};
		},
	};
};
