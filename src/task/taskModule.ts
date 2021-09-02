import {sourceIdToBasePath, paths, pathsFromId} from '../paths.js';
import {loadModule, loadModules, findModules} from '../fs/modules.js';
import type {ModuleMeta, LoadModuleResult} from 'src/fs/modules.js';
import {toTaskName, isTaskPath, TASK_FILE_SUFFIX} from './task.js';
import type {Task} from 'src/task/task.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Record<string, any>): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const loadTaskModule = async (
	id: string,
	dev: boolean,
): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await loadModule(id, dev, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(sourceIdToBasePath(id, pathsFromId(id)))},
	};
};

export const loadTaskModules = async (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [TASK_FILE_SUFFIX],
	rootDirs: string[] = [],
) => {
	const findModulesResult = await findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => isTaskPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
	if (!findModulesResult.ok) return findModulesResult;
	return loadModules(findModulesResult.sourceIdsByInputPath, true, loadTaskModule);
};
