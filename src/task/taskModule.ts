import {source_id_to_base_path, paths, paths_from_id} from '../paths.js';
import {loadModule, loadModules, findModules} from '../fs/modules.js';
import type {ModuleMeta, LoadModuleResult} from '../fs/modules.js';
import {toTaskName, isTaskPath, TASK_FILE_SUFFIX} from './task.js';
import type {Task} from './task.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Record<string, any>): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const loadTaskModule = async (id: string): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await loadModule(id, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(source_id_to_base_path(id, paths_from_id(id)))},
	};
};

export const loadTaskModules = async (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [TASK_FILE_SUFFIX],
	root_dirs: string[] = [],
) => {
	const findModulesResult = await findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => isTaskPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, root_dirs),
	);
	if (!findModulesResult.ok) return findModulesResult;
	return loadModules(findModulesResult.source_idsByInputPath, loadTaskModule);
};
