import {
	load_module,
	load_modules,
	find_modules,
	type Module_Meta,
	type Load_Module_Result,
	type Find_Modules_Failure,
	type Find_Modules_Result,
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

// TODO BLOCK
export interface Task_Info {
	//
}

export const validate_task_module = (mod: Record<string, any>): mod is Task_Module =>
	!!mod.task && typeof mod.task.run === 'function';

export const load_task_module = async (
	id: string,
	task_root_paths: string[],
): Promise<Load_Module_Result<Task_Module_Meta>> => {
	const result = await load_module(id, validate_task_module);
	if (!result.ok) return result;
	return {...result, mod: {...result.mod, name: to_task_name(id, task_root_paths)}}; // TODO this task name needs to use task root paths or cwd
};

export const find_task_modules = async (
	input_paths: Input_Path[],
	task_root_paths: string[],
): Promise<{find_modules_result: Find_Modules_Result; task_infos: Task_Info[]}> => {
	const find_modules_result = await find_modules(
		input_paths,
		(id) => search_fs(id, {filter: (path) => is_task_path(path)}),
		(input_path) =>
			get_possible_source_ids(
				input_path,
				[TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS],
				task_root_paths,
			),
	);
	console.log(`find_modules_result`, find_modules_result);
	const task_infos: Task_Info[] = []; // TODO BLOCK maybe separate this into `resolve_task_info`? given a `Find_Modules_Result`?
	return {find_modules_result, task_infos};
};

export const load_task_modules = async (
	input_paths: Input_Path[],
	task_root_paths: string[],
): Promise<
	| ReturnType<typeof load_modules<Task_Module, Task_Module_Meta>>
	| ({ok: false} & Find_Modules_Failure)
> => {
	const {find_modules_result} = await find_task_modules(input_paths, task_root_paths);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, (id) =>
		load_task_module(id, task_root_paths),
	);
};
