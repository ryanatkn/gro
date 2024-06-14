import {
	load_module,
	load_modules,
	find_modules,
	type Module_Meta,
	type Load_Module_Result,
	type Find_Modules_Failure,
} from './modules.js';
import {
	to_task_name,
	is_task_path,
	TASK_FILE_SUFFIX_TS,
	type Task,
	TASK_FILE_SUFFIX_JS,
} from './task.js';
import {Input_Path, get_possible_source_ids} from './input_path.js';
import {search_fs} from './search_fs.js';

export interface Task_Module {
	task: Task;
}

export interface Task_Module_Meta extends Module_Meta<Task_Module> {
	name: string;
}

export const validate_task_module = (mod: Record<string, any>): mod is Task_Module =>
	!!mod.task && typeof mod.task.run === 'function';

export const load_task_module = async (
	id: string,
): Promise<Load_Module_Result<Task_Module_Meta>> => {
	const result = await load_module(id, validate_task_module);
	if (!result.ok) return result;
	return {...result, mod: {...result.mod, name: to_task_name(id)}}; // TODO BLOCK this task name needs to use base paths
};

export const find_task_modules = async (
	input_paths: Input_Path[],
	root_dirs?: string[],
): Promise<ReturnType<typeof find_modules>> =>
	find_modules(
		input_paths,
		(id) => search_fs(id, {filter: (path) => is_task_path(path)}),
		(input_path) =>
			get_possible_source_ids(input_path, [TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS], root_dirs),
	);

export const load_task_modules = async (
	input_paths: Input_Path[],
	root_dirs?: string[],
): Promise<
	| ReturnType<typeof load_modules<Task_Module, Task_Module_Meta>>
	| ({ok: false} & Find_Modules_Failure)
> => {
	const find_modules_result = await find_task_modules(input_paths, root_dirs);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, load_task_module);
};
