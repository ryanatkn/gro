import type {Logger} from '@ryanatkn/belt/log.js';
import {strip_end, strip_start} from '@ryanatkn/belt/string.js';
import type {z} from 'zod';
import type {Timings} from '@ryanatkn/belt/timings.js';
import {red} from 'kleur/colors';
import type {Result} from '@ryanatkn/belt/result.js';

import type {Args} from './args.js';
import type {Path_Id} from './path.js';
import type {Gro_Config} from './config.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {
	resolve_input_files,
	resolve_input_paths,
	type Input_Path,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.js';
import {print_path} from './paths.js';
import {search_fs} from './search_fs.js';
import {load_modules, type Load_Module_Failure, type Module_Meta} from './modules.js';

export interface Task<
	T_Args = Args, // same as `z.infer<typeof Args>`
	T_Args_Schema extends z.ZodType = z.ZodType,
	T_Return = unknown,
> {
	run: (ctx: Task_Context<T_Args>) => Promise<T_Return>; // TODO return value (make generic, forward it..how?)
	summary?: string;
	Args?: T_Args_Schema;
}

export interface Task_Context<T_Args = object> {
	args: T_Args;
	config: Gro_Config;
	sveltekit_config: Parsed_Sveltekit_Config;
	// TODO should this go here or on `config` for convenience?
	// sveltekit_config: Parsed_Sveltekit_Config;
	log: Logger;
	timings: Timings;
	invoke_task: (task_name: string, args?: Args, config?: Gro_Config) => Promise<void>;
}

export const TASK_FILE_SUFFIX_TS = '.task.ts';
export const TASK_FILE_SUFFIX_JS = '.task.js';
export const TASK_FILE_SUFFIXES = [TASK_FILE_SUFFIX_TS, TASK_FILE_SUFFIX_JS]; // TODO from `Gro_Config`, but needs to be used everywhere the constants are

export const is_task_path = (path: string): boolean =>
	path.endsWith(TASK_FILE_SUFFIX_TS) || path.endsWith(TASK_FILE_SUFFIX_JS);

export const to_task_name = (id: Path_Id, task_root_dir: Path_Id | null): string => {
	let task_name =
		task_root_dir && id.startsWith(task_root_dir)
			? strip_start(strip_start(id, task_root_dir), '/')
			: id;
	for (const suffix of TASK_FILE_SUFFIXES) {
		task_name = strip_end(task_name, suffix);
	}
	return task_name;
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class Task_Error extends Error {}

export interface Found_Task {
	input_path: Input_Path;
	id: Path_Id;
	task_root_dir: Path_Id;
}

export interface Found_Tasks {
	resolved_input_files: Resolved_Input_File[];
	resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
	resolved_input_paths: Resolved_Input_Path[];
	resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
	input_paths: Input_Path[];
	task_root_dirs: Path_Id[];
}

export type Find_Tasks_Result = Result<{value: Found_Tasks}, Find_Modules_Failure>;
export type Find_Modules_Failure =
	| {
			type: 'unmapped_input_paths';
			unmapped_input_paths: Input_Path[];
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
			input_paths: Input_Path[];
			task_root_dirs: Path_Id[];
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			input_directories_with_no_files: Resolved_Input_Path[];
			resolved_input_files: Resolved_Input_File[];
			resolved_input_files_by_input_path: Map<Input_Path, Resolved_Input_File[]>;
			resolved_input_paths: Resolved_Input_Path[];
			resolved_input_path_by_input_path: Map<Input_Path, Resolved_Input_Path>;
			input_paths: Input_Path[];
			task_root_dirs: Path_Id[];
			reasons: string[];
	  };

/**
 * Finds modules from input paths. (see `src/lib/input_path.ts` for more)
 */
export const find_tasks = async (
	input_paths: Input_Path[],
	task_root_dirs: Path_Id[],
	timings?: Timings,
): Promise<Find_Tasks_Result> => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const resolved = await resolve_input_paths(input_paths, task_root_dirs, TASK_FILE_SUFFIXES);
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
			input_paths,
			task_root_dirs,
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
			input_paths,
			task_root_dirs,
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
		value: {
			resolved_input_files,
			resolved_input_files_by_input_path,
			resolved_input_paths,
			resolved_input_path_by_input_path,
			input_paths,
			task_root_dirs,
		},
	};
};

export interface Loaded_Tasks {
	modules: Task_Module_Meta[];
	found_tasks: Found_Tasks;
}

export interface Task_Module {
	task: Task;
}

export interface Task_Module_Meta extends Module_Meta<Task_Module> {
	name: string;
}

export type Load_Tasks_Result = Result<{value: Loaded_Tasks}, Load_Tasks_Failure>;
export type Load_Tasks_Failure = {
	type: 'load_module_failures';
	load_module_failures: Load_Module_Failure[];
	reasons: string[];
	// still return the modules and timings, deferring to the caller
	modules: Task_Module_Meta[];
};

export const load_tasks = async (found_tasks: Found_Tasks): Promise<Load_Tasks_Result> => {
	const loaded_modules = await load_modules(
		found_tasks.resolved_input_files,
		validate_task_module,
		(id, mod): Task_Module_Meta => ({
			id,
			mod,
			// TODO BLOCK maybe add `resolved_input_file_by_id`?
			name: to_task_name(
				id,
				found_tasks.resolved_input_files.find((r) => r.id === id)!.resolved_input_path.root_dir,
			),
		}),
	);
	if (!loaded_modules.ok) {
		return loaded_modules;
	}

	return {
		ok: true,
		value: {modules: loaded_modules.modules, found_tasks},
	};
};

export const validate_task_module = (mod: Record<string, any>): mod is Task_Module =>
	!!mod.task && typeof mod.task.run === 'function';
