import type {Timings} from '@ryanatkn/belt/timings.js';

import {load_module, load_modules, type Module_Meta, type Load_Module_Result} from './modules.js';
import {
	to_task_name,
	is_task_path,
	TASK_FILE_SUFFIX_TS,
	type Task,
	TASK_FILE_SUFFIX_JS,
} from './task.js';
import {
	Input_Path,
	get_possible_source_ids,
	load_source_ids_by_input_path,
	resolve_input_paths,
} from './input_path.js';
import {search_fs} from './search_fs.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {paths_from_id, print_path_or_gro_path, type Source_Id} from './paths.js';
import type {Path_Data} from './path.js';
import {red} from 'kleur/colors';

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
	task_root_paths: string[],
): Promise<Load_Module_Result<Task_Module_Meta>> => {
	const result = await load_module(id, validate_task_module);
	if (!result.ok) return result;
	return {...result, mod: {...result.mod, name: to_task_name(id, task_root_paths)}}; // TODO this task name needs to use task root paths or cwd
};

export const load_task_modules = async (
	input_paths: Input_Path[],
	task_root_paths: string[],
): Promise<
	| ReturnType<typeof load_modules<Task_Module, Task_Module_Meta>>
	| ({ok: false} & Find_Modules_Failure)
> => {
	const find_modules_result = await find_tasks(input_paths, task_root_paths);
	if (!find_modules_result.ok) return find_modules_result;
	return load_modules(find_modules_result.source_ids_by_input_path, (id) =>
		load_task_module(id, task_root_paths),
	);
};

// TODO BLOCK
export interface Found_Task {
	input_path: Input_Path;
	id: Source_Id;
	task_root_paths: string; // TODO BLOCK `Path_Id`?
}

export type Find_Tasks_Result = Result<
	{
		// TODO BLOCK should these be bundled into a single data structure?
		source_ids_by_input_path: Map<Input_Path, Source_Id[]>;
		path_data_by_input_path: Map<Input_Path, Path_Data>;
		possible_source_ids_by_input_path: Map<Input_Path, Source_Id[]>;
	},
	Find_Modules_Failure
>;
export type Find_Modules_Failure =
	| {
			type: 'unmapped_input_paths';
			path_data_by_input_path: Map<Input_Path, Path_Data>;
			unmapped_input_paths: Input_Path[];
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			source_ids_by_input_path: Map<Input_Path, Source_Id[]>;
			path_data_by_input_path: Map<Input_Path, Path_Data>;
			input_directories_with_no_files: Input_Path[];
			reasons: string[];
	  };

/**
 * Finds modules from input paths. (see `src/lib/input_path.ts` for more)
 */
export const find_tasks = async (
	input_paths: Input_Path[],
	task_root_paths: string[],
	timings?: Timings,
): Promise<Find_Tasks_Result> => {
	const found_tasks: Found_Task[] = []; // TODO BLOCK maybe separate this into `resolve_task_info`? given a `Find_Modules_Result`?

	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const {path_data_by_input_path, unmapped_input_paths, possible_source_ids_by_input_path} =
		await resolve_input_paths(input_paths, (input_path) =>
			get_possible_source_ids(
				input_path,
				[TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS],
				task_root_paths,
			),
		);
	console.log('[find_modules] path_data_by_input_path', path_data_by_input_path);
	timing_to_resolve_input_paths?.();

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			path_data_by_input_path,
			unmapped_input_paths,
			reasons: unmapped_input_paths.map((input_path) =>
				red(
					`Input path ${print_path_or_gro_path(
						input_path,
						paths_from_id(input_path),
					)} cannot be mapped to a file or directory.`,
				),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_search_fs = timings?.start('find files');
	const {source_ids_by_input_path, input_directories_with_no_files} =
		await load_source_ids_by_input_path(path_data_by_input_path, (id) =>
			search_fs(id, {filter: (path) => is_task_path(path)}),
		);
	timing_to_search_fs?.();

	// Error if any input path has no files. (means we have an empty directory)
	if (input_directories_with_no_files.length) {
		return {
			ok: false,
			type: 'input_directories_with_no_files',
			path_data_by_input_path,
			source_ids_by_input_path,
			input_directories_with_no_files,
			reasons: input_directories_with_no_files.map((input_path) =>
				red(
					`Input directory ${print_path_or_gro_path(
						path_data_by_input_path.get(input_path)!.id,
						paths_from_id(input_path),
					)} contains no matching files.`,
				),
			),
		};
	}

	return {
		ok: true,
		source_ids_by_input_path,
		path_data_by_input_path,
		possible_source_ids_by_input_path,
	};
};
