import {source_id_to_base_path, paths, paths_from_id} from '../path/paths.js';
import {
	load_module,
	load_modules,
	find_modules,
	type ModuleMeta,
	type LoadModuleResult,
	type FindModulesFailure,
} from '../fs/modules.js';
import {to_task_name, is_task_path, TASK_FILE_SUFFIX, type Task} from './task.js';
import {get_possible_source_ids} from '../path/inputPath.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validate_task_module = (mod: Record<string, any>): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const load_task_module = async (id: string): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await load_module(id, validate_task_module);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: to_task_name(source_id_to_base_path(id, paths_from_id(id)))},
	};
};

export const find_task_modules = async (
	fs: Filesystem,
	input_paths: string[] = [paths.lib],
	extensions: string[] = [TASK_FILE_SUFFIX],
	root_dirs?: string[],
): Promise<ReturnType<typeof find_modules>> =>
	find_modules(
		fs,
		input_paths,
		(id) => fs.findFiles(id, (path) => is_task_path(path)),
		(inputPath) => get_possible_source_ids(inputPath, extensions, root_dirs),
	);

// TODO BLOCK see others
export const loadTaskModules = async (
	fs: Filesystem,
	input_paths?: string[],
	extensions?: string[],
	root_dirs?: string[],
): Promise<
	ReturnType<typeof load_modules<TaskModule, TaskModuleMeta>> | ({ok: false} & FindModulesFailure)
> => {
	const find_modules_result = await find_task_modules(fs, input_paths, extensions, root_dirs);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, true, load_task_module);
};
