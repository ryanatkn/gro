import fs from 'fs-extra';
import {join} from 'path';
import CheapWatch from 'cheap-watch';

import {LogLevel, logger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {FileStats} from '../project/fileData.js';
import {fmtPath} from '../utils/fmt.js';
import {GenHost, GEN_FILE_PATTERN, validateGenModule} from './gen.js';
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
		findGenModules: async dir => {
			info(`finding all gens in ${fmtPath(dir)}`);
			const sourceIds: string[] = [];

			const buildDir = toBuildId(dir);

			// TODO refactor to use the same file & watch solution as  `NodeTestContext` and `project/assets.ts`
			const filter: (p: {path: string; stats: FileStats}) => boolean = ({
				path,
				stats,
			}) =>
				stats.isDirectory() ||
				(path.includes(GEN_FILE_PATTERN) && path.endsWith('.js')); // excludes sourcemap and other meta files
			const watch = false;
			const watcher = new CheapWatch({dir: buildDir, filter, watch});

			await watcher.init();
			for (const [path, stats] of watcher.paths) {
				if (stats.isDirectory()) continue;
				const sourceId = toSourceId(join(buildDir, path));
				trace('found gen', fmtPath(sourceId));
				sourceIds.push(sourceId);
			}
			watcher.close();
			watcher.removeAllListeners();

			return sourceIds;
		},
		loadGenModule: async sourceId => {
			const buildId = toBuildId(sourceId);
			const mod = await import(buildId);
			if (!validateGenModule(mod)) {
				throw Error(`Invalid gen module: ${buildId}`);
			}
			return {id: sourceId, mod};
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
