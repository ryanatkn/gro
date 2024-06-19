import type {Timings} from '@ryanatkn/belt/timings.js';

import {load_module, load_modules, type Module_Meta, type Load_Module_Result} from './modules.js';
import {to_task_name, is_task_path, type Task, TASK_FILE_SUFFIXES} from './task.js';
import {
	Input_Path,
	resolve_input_files,
	resolve_input_paths,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.js';
import {search_fs} from './search_fs.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {print_path} from './paths.js';
import type {Path_Id} from './path.js';
import {red} from 'kleur/colors';

// TODO BLOCK merge into `task.ts` probably

// TODO BLOCK
export interface Found_Task {
	input_path: Input_Path;
	id: Path_Id;
	task_root_path: Path_Id;
}

export type Find_Tasks_Result = Result<
	{
		// TODO BLOCK should these be bundled into a single data structure?
		resolved_input_files: Resolved_Input_File[];
		resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
		resolved_input_paths: Resolved_Input_Path[]; // TODO BLOCK probably add `input_path_datas` and just use it
		resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
	},
	Find_Modules_Failure
>;
export type Find_Modules_Failure =
	| {
			type: 'unmapped_input_paths';
			unmapped_input_paths: Input_Path[];
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			input_directories_with_no_files: Resolved_Input_Path[];
			resolved_input_files: Resolved_Input_File[];
			resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
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
	// TODO BLOCK so each input path gets associated with one `task_root_path`, right? cache in a data structure?
	// TODO BLOCK if we resolve to path data that's a directory, it shouldn't add the task suffixes to possible source ids
	const found_tasks: Found_Task[] = []; // TODO BLOCK maybe separate this into `resolve_task_info`? given a `Find_Modules_Result`?

	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const resolved = await resolve_input_paths(input_paths, task_root_paths, TASK_FILE_SUFFIXES);
	console.log('[find_modules] resolved', resolved);
	const {resolved_input_paths, unmapped_input_paths} = resolved;
	timing_to_resolve_input_paths?.();

	const resolved_input_path_by_input_path = new Map(
		resolved_input_paths.map((r) => [r.input_path, r]),
	);

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			unmapped_input_paths,
			resolved_input_paths,
			resolved_input_path_by_input_path,
			reasons: unmapped_input_paths.map((input_path) =>
				red(`Input path ${print_path(input_path)} cannot be mapped to a file or directory.`),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_search_fs = timings?.start('find files');
	const {
		resolved_input_files,
		resolved_input_files_by_input_path,
		input_directories_with_no_files,
	} = await resolve_input_files(resolved_input_paths, (id) =>
		search_fs(id, {filter: (path) => is_task_path(path)}),
	);
	timing_to_search_fs?.();

	// Error if any input path has no files. (means we have an empty directory)
	if (input_directories_with_no_files.length) {
		return {
			ok: false,
			type: 'input_directories_with_no_files',
			input_directories_with_no_files,
			resolved_input_files,
			resolved_input_files_by_input_path,
			resolved_input_paths,
			resolved_input_path_by_input_path,
			reasons: input_directories_with_no_files.map(({input_path}) =>
				red(
					`Input directory ${print_path(
						resolved_input_path_by_input_path.get(input_path)!.id,
					)} contains no matching files.`,
				),
			),
		};
	}

	return {
		ok: true,
		resolved_input_files,
		resolved_input_files_by_input_path,
		resolved_input_paths,
		resolved_input_path_by_input_path,
	};
};

export interface Task_Module {
	task: Task;
}

export interface Task_Module_Meta extends Module_Meta<Task_Module> {
	name: string;
}

export const validate_task_module = (mod: Record<string, any>): mod is Task_Module =>
	!!mod.task && typeof mod.task.run === 'function';

// TODO BLOCK probably rename to `load_task`, or remove and inline in `load_tasks`
export const load_task_module = async (
	id: string,
	task_root_paths: string[],
): Promise<Load_Module_Result<Task_Module_Meta>> => {
	const result = await load_module(id, validate_task_module);
	if (!result.ok) return result;
	// TODO BLOCK this is weird with the spreads
	return {...result, mod: {...result.mod, name: to_task_name(id, task_root_paths)}}; // TODO this task name needs to use task root paths or cwd
};

export const load_tasks = async (
	resolved_input_files: Resolved_Input_File[],
	task_root_paths: string[],
): Promise<
	| ReturnType<typeof load_modules<Task_Module, Task_Module_Meta>>
	| ({ok: false} & Find_Modules_Failure)
> => {
	// TODO BLOCK use everywhere and refactor the helpers?
	return load_modules(resolved_input_files, (id) => load_task_module(id, task_root_paths));
};
