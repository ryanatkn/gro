import {source_id_to_base_path, paths, paths_from_id} from '../paths.js';
import {loadModule, load_modules, findModules} from '../fs/modules.js';
import type {Module_Meta, Load_Module_Result} from '../fs/modules.js';
import {toTaskName, isTaskPath, TASK_FILE_SUFFIX} from './task.js';
import type {Task} from './task.js';
import {getPossibleSourceIds} from '../fs/inputPath.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModule_Meta extends Module_Meta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Record<string, any>): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const load_task_module = async (
	id: string,
): Promise<Load_Module_Result<TaskModule_Meta>> => {
	const result = await loadModule(id, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(source_id_to_base_path(id, paths_from_id(id)))},
	};
};

export const load_task_modules = async (
	fs: Filesystem,
	inputPaths: string[] = [paths.source],
	extensions: string[] = [TASK_FILE_SUFFIX],
	root_dirs: string[] = [],
) => {
	const find_modules_result = await findModules(
		fs,
		inputPaths,
		(id) => fs.findFiles(id, (file) => isTaskPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, extensions, root_dirs),
	);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, load_task_module);
};
