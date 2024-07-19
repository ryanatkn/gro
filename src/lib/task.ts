import type {Logger} from '@ryanatkn/belt/log.js';
import {ensure_end, strip_end, strip_start} from '@ryanatkn/belt/string.js';
import type {z} from 'zod';
import type {Timings} from '@ryanatkn/belt/timings.js';
import {red} from '@ryanatkn/belt/styletext.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {isAbsolute, join, relative} from 'node:path';

import type {Args} from './args.js';
import type {Path_Id} from './path.js';
import type {Gro_Config} from './gro_config.js';
import type {Parsed_Sveltekit_Config} from './sveltekit_config.js';
import {
	resolve_input_files,
	resolve_input_paths,
	type Input_Path,
	type Resolved_Input_File,
	type Resolved_Input_Path,
} from './input_path.js';
import {GRO_DIST_DIR, print_path} from './paths.js';
import {search_fs} from './search_fs.js';
import {load_modules, type Load_Modules_Failure, type Module_Meta} from './modules.js';

export interface Task<
	T_Args = Args, // same as `z.infer<typeof Args>`
	T_Args_Schema extends z.ZodType = z.ZodType,
	T_Return = unknown,
> {
	run: (ctx: Task_Context<T_Args>) => T_Return | Promise<T_Return>; // TODO unused return value
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

export const to_task_name = (
	id: Path_Id,
	task_root_dir: Path_Id,
	input_path: Input_Path,
	root_path: Path_Id,
): string => {
	let task_name = id.startsWith(task_root_dir)
		? strip_start(strip_start(id, task_root_dir), '/')
		: id;
	for (const suffix of TASK_FILE_SUFFIXES) {
		task_name = strip_end(task_name, suffix);
	}
	if (ensure_end(task_root_dir, '/') === GRO_DIST_DIR) {
		// TODO ideally it would display this in some contexts like the task progress logs,
		// but not all, like printing the task list, UNLESS there's a local override
		// return 'gro/' + task_name;
		return task_name;
	}
	if (isAbsolute(input_path)) {
		return relative(root_path, join(task_root_dir, task_name));
	}
	return task_name;
};

/**
 * This is used by tasks to signal a known failure.
 * It's useful for cleaning up logging because
 * we usually don't need their stack trace.
 */
export class Task_Error extends Error {}

/**
 * This is used to tell Gro to exit silently, usually still with with a non-zero exit code.
 * Using it means error logging is handled by the code that threw it.
 */
export class Silent_Error extends Error {}

export interface Found_Task {
	input_path: Input_Path;
	id: Path_Id;
	task_root_dir: Path_Id;
}

export interface Found_Tasks {
	resolved_input_files: Resolved_Input_File[];
	resolved_input_files_by_root_dir: Map<Path_Id, Resolved_Input_File[]>;
	resolved_input_paths: Resolved_Input_Path[];
	input_paths: Input_Path[];
	task_root_dirs: Path_Id[];
}

export type Find_Tasks_Result = Result<{value: Found_Tasks}, Find_Modules_Failure>;
export type Find_Modules_Failure =
	| {
			type: 'unmapped_input_paths';
			unmapped_input_paths: Input_Path[];
			resolved_input_paths: Resolved_Input_Path[];
			input_paths: Input_Path[];
			task_root_dirs: Path_Id[];
			reasons: string[];
	  }
	| {
			type: 'input_directories_with_no_files';
			input_directories_with_no_files: Input_Path[];
			resolved_input_files: Resolved_Input_File[];
			resolved_input_files_by_root_dir: Map<Path_Id, Resolved_Input_File[]>;
			resolved_input_paths: Resolved_Input_Path[];
			input_paths: Input_Path[];
			task_root_dirs: Path_Id[];
			reasons: string[];
	  };

/**
 * Finds modules from input paths. (see `src/lib/input_path.ts` for more)
 */
export const find_tasks = (
	input_paths: Input_Path[],
	task_root_dirs: Path_Id[],
	config: Gro_Config,
	timings?: Timings,
): Find_Tasks_Result => {
	// Check which extension variation works - if it's a directory, prefer others first!
	const timing_to_resolve_input_paths = timings?.start('resolve input paths');
	const {resolved_input_paths, unmapped_input_paths} = resolve_input_paths(
		input_paths,
		task_root_dirs,
		TASK_FILE_SUFFIXES,
	);
	timing_to_resolve_input_paths?.();

	// Error if any input path could not be mapped.
	if (unmapped_input_paths.length) {
		return {
			ok: false,
			type: 'unmapped_input_paths',
			unmapped_input_paths,
			resolved_input_paths,
			input_paths,
			task_root_dirs,
			reasons: unmapped_input_paths.map((input_path) =>
				red(`Input path ${print_path(input_path)} cannot be mapped to a file or directory.`),
			),
		};
	}

	// Find all of the files for any directories.
	const timing_to_resolve_input_files = timings?.start('resolve input files');
	const {resolved_input_files, resolved_input_files_by_root_dir, input_directories_with_no_files} =
		resolve_input_files(resolved_input_paths, (id) =>
			search_fs(id, {
				filter: config.search_filters,
				file_filter: (p) => TASK_FILE_SUFFIXES.some((s) => p.endsWith(s)),
			}),
		);
	timing_to_resolve_input_files?.();

	// Error if any input path has no files. (means we have an empty directory)
	if (input_directories_with_no_files.length) {
		return {
			ok: false,
			type: 'input_directories_with_no_files',
			input_directories_with_no_files,
			resolved_input_files,
			resolved_input_files_by_root_dir,
			resolved_input_paths,
			input_paths,
			task_root_dirs,
			reasons: input_directories_with_no_files.map((input_path) =>
				red(`Input directory contains no matching files: ${print_path(input_path)}`),
			),
		};
	}

	return {
		ok: true,
		value: {
			resolved_input_files,
			resolved_input_files_by_root_dir,
			resolved_input_paths,
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
export type Load_Tasks_Failure = Load_Modules_Failure<Task_Module_Meta>;

export const load_tasks = async (
	found_tasks: Found_Tasks,
	root_path: Path_Id = process.cwd(), // TODO @many isn't passed in anywhere, maybe hoist to `invoke_task` and others
): Promise<Load_Tasks_Result> => {
	const loaded_modules = await load_modules(
		found_tasks.resolved_input_files,
		validate_task_module,
		(resolved_input_file, mod): Task_Module_Meta => ({
			id: resolved_input_file.id,
			mod,
			name: to_task_name(
				resolved_input_file.id,
				resolved_input_file.resolved_input_path.root_dir,
				resolved_input_file.resolved_input_path.input_path,
				root_path,
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
