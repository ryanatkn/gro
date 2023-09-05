import {source_idToBasePath, paths, pathsFromId} from '../path/paths.js';
import {
	loadModule,
	loadModules,
	findModules,
	type ModuleMeta,
	type LoadModuleResult,
	type FindModulesFailure,
} from '../fs/modules.js';
import {toTaskName, isTaskPath, TASK_FILE_SUFFIX, type Task} from './task.js';
import {getPossibleSourceIds} from '../path/inputPath.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Record<string, any>): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const load_task_module = async (id: string): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await loadModule(id, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(source_idToBasePath(id, pathsFromId(id)))},
	};
};

export const findTaskModules = async (
	fs: Filesystem,
	inputPaths: string[] = [paths.lib],
	extensions: string[] = [TASK_FILE_SUFFIX],
	rootDirs?: string[],
): Promise<ReturnType<typeof findModules>> =>
	findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (path) => isTaskPath(path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);

// TODO BLOCK see others
export const loadTaskModules = async (
	fs: Filesystem,
	inputPaths?: string[],
	extensions?: string[],
	rootDirs?: string[],
): Promise<
	ReturnType<typeof loadModules<TaskModule, TaskModuleMeta>> | ({ok: false} & FindModulesFailure)
> => {
	const findModulesResult = await findTaskModules(fs, inputPaths, extensions, rootDirs);
	if (!findModulesResult.ok) return findModulesResult;
	return loadModules(findModulesResult.source_idsByInputPath, true, load_task_module);
};
