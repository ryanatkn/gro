import {join} from 'path';

import {SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {fmtPath} from '../utils/fmt.js';
import {RunHost} from './run.js';
import {isTaskPath, toTaskName, TaskModuleMeta} from './task.js';
import {toBuildId, toSourceId, toBasePath} from '../paths.js';
import {findFiles} from '../files/nodeFs.js';

export const createNodeRunHost = (): RunHost => {
	const {info, trace} = new SystemLogger([magenta('[run]')]);

	return {
		findTaskModules: async (dir: string): Promise<string[]> => {
			info(`finding all tasks in ${fmtPath(dir)}`);
			const sourceIds: string[] = [];

			const buildDir = toBuildId(dir);

			const paths = await findFiles(buildDir);
			for (const [path, stats] of paths) {
				if (stats.isDirectory()) continue;
				const sourceId = toSourceId(join(buildDir, path));
				if (!isTaskPath(sourceId)) continue;
				trace('found task', fmtPath(sourceId));
				sourceIds.push(sourceId);
			}

			return sourceIds;
		},
		loadTaskModule: async (sourceId: string): Promise<TaskModuleMeta> => {
			trace('loading task', fmtPath(sourceId));
			const buildId = toBuildId(sourceId);
			const mod = await import(buildId);
			return {
				id: sourceId,
				name: toTaskName(toBasePath(sourceId)),
				mod,
			};
		},
	};
};
