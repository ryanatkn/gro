import {source_id_to_base_path, paths, paths_from_id} from '../path/paths.js';
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
		mod: {...result.mod, name: toTaskName(source_id_to_base_path(id, paths_from_id(id)))},
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
	const find_modules_result = await findTaskModules(fs, inputPaths, extensions, rootDirs);
	if (!find_modules_result.ok) return find_modules_result;
	return loadModules(find_modules_result.source_idsByInputPath, true, load_task_module);
};
