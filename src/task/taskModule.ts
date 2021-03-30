import {sourceIdToBasePath, paths, pathsFromId} from '../paths.js';
import {ModuleMeta, LoadModuleResult, loadModule, loadModules, findModules} from '../fs/modules.js';
import {Task, toTaskName, isTaskPath, TASK_FILE_SUFFIX} from './task.js';
import {findFiles} from '../fs/nodeFs.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import type {Obj} from '../types.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Obj): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const loadTaskModule = async (id: string): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await loadModule(id, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(sourceIdToBasePath(id, pathsFromId(id)))},
	};
};

export const loadTaskModules = async (
	inputPaths: string[] = [paths.source],
	extensions: string[] = [TASK_FILE_SUFFIX],
	rootDirs: string[] = [],
) => {
	const findModulesResult = await findModules(
		inputPaths,
		(id) => findFiles(id, (file) => isTaskPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
	if (!findModulesResult.ok) return findModulesResult;
	return loadModules(findModulesResult.sourceIdsByInputPath, loadTaskModule);
};
