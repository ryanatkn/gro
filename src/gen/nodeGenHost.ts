import fs from 'fs-extra';
import {join} from 'path';

import {LogLevel, logger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {omitUndefined} from '../utils/object.js';
import {fmtPath} from '../utils/fmt.js';
import {GenHost, isGenPath} from './gen.js';
import {toBuildId, toSourceId} from '../paths.js';
import {findFiles} from '../fs/nodeFs.js';

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
		findGenModules: async dir => {
			info(`finding all gens in ${fmtPath(dir)}`);
			const sourceIds: string[] = [];

			const buildDir = toBuildId(dir);

			const paths = await findFiles(
				buildDir,
				({path}) => isGenPath(path) && path.endsWith('.js'),
			);
			for (const [path, stats] of paths) {
				if (stats.isDirectory()) continue;
				const sourceId = toSourceId(join(buildDir, path));
				trace('found gen', fmtPath(sourceId));
				sourceIds.push(sourceId);
			}

			return sourceIds;
		},
		loadGenModule: async sourceId => {
			const buildId = toBuildId(sourceId);
			const mod = await import(buildId);
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
