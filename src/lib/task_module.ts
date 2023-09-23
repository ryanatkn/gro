import {paths} from './paths.js';
import {
	load_module,
	load_modules,
	find_modules,
	type ModuleMeta,
	type LoadModuleResult,
	type FindModulesFailure,
} from './modules.js';
import {
	to_task_name,
	is_task_path,
	TASK_FILE_SUFFIX_TS,
	type Task,
	TASK_FILE_SUFFIX_JS,
} from './task.js';
import {get_possible_source_ids} from './input_path.js';
import {search_fs} from './search_fs.js';

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
	return {...result, mod: {...result.mod, name: to_task_name(id)}};
};

export const find_task_modules = async (
	input_paths: string[] = [paths.lib],
	extensions: string[] = [TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS],
	root_dirs?: string[],
): Promise<ReturnType<typeof find_modules>> =>
	find_modules(
		input_paths,
		(id) => search_fs(id, {filter: (path) => is_task_path(path)}),
		(input_path) => get_possible_source_ids(input_path, extensions, root_dirs),
	);

export const load_task_modules = async (
	input_paths?: string[],
	extensions?: string[],
	root_dirs?: string[],
): Promise<
	ReturnType<typeof load_modules<TaskModule, TaskModuleMeta>> | ({ok: false} & FindModulesFailure)
> => {
	const find_modules_result = await find_task_modules(input_paths, extensions, root_dirs);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, load_task_module);
};
