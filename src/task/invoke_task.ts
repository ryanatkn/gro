import {cyan, red, gray} from '@feltcoop/felt/utils/terminal.js';
import {System_Logger, Logger, print_log_label} from '@feltcoop/felt/utils/log.js';
import {EventEmitter} from 'events';
import {create_stopwatch, Timings} from '@feltcoop/felt/utils/time.js';
import {printMs, print_timings} from '@feltcoop/felt/utils/print.js';
import {plural} from '@feltcoop/felt/utils/string.js';

import type {Args} from './task.js';
import {run_task} from './run_task.js';
import {resolve_raw_input_path, get_possible_source_ids} from '../fs/input_path.js';
import {TASK_FILE_SUFFIX, is_task_path, to_task_name} from './task.js';
import {
	paths,
	gro_paths,
	source_id_to_base_path,
	replace_root_dir,
	paths_from_id,
	is_gro_id,
	to_import_id,
	is_this_project_gro,
	print_path,
	print_path_or_gro_path,
} from '../paths.js';
import {find_modules, load_modules} from '../fs/modules.js';
import {load_task_module} from './task_module.js';
import {load_gro_package_json} from '../utils/package_json.js';
import {SYSTEM_BUILD_NAME} from '../build/default_build_config.js';
import type {Filesystem} from '../fs/filesystem.js';

/*

This module invokes Gro tasks by name using the filesystem as the source.

When a task is invoked,
it first searches for tasks in the current working directory.
and falls back to searching Gro's directory, if the two are different.
See `src/fs/input_path.ts` for info about what "task_name" can refer to.
If it matches a directory, all of the tasks within it are logged,
both in the current working directory and Gro.

This code is particularly hairy because
we're accepting a wide range of user input
and trying to do the right thing.
Precise error messages are especially difficult and
there are some subtle differences in the complex logical branches.
The comments describe each condition.

*/

export const invoke_task = async (
	fs: Filesystem,
	task_name: string,
	args: Args,
	events = new EventEmitter(),
	dev?: boolean,
): Promise<void> => {
	const log = new System_Logger(print_log_label(task_name || 'gro'));

	// Check if the caller just wants to see the version.
	if (!task_name && (args.version || args.v)) {
		const gro_package_json = await load_gro_package_json(fs);
		log.info(`${gray('v')}${cyan(gro_package_json.version as string)}`);
		return;
	}

	const total_timing = create_stopwatch();
	const timings = new Timings();

	// Resolve the input path for the provided task name.
	const input_path = resolve_raw_input_path(task_name || paths.source);

	// Find the task or directory specified by the `input_path`.
	// Fall back to searching the Gro directory as well.
	const find_modules_result = await find_modules(
		fs,
		[input_path],
		(id) => fs.find_files(id, (file) => is_task_path(file.path)),
		(input_path) => get_possible_source_ids(input_path, [TASK_FILE_SUFFIX], [gro_paths.root]),
	);

	if (find_modules_result.ok) {
		timings.merge(find_modules_result.timings);
		// Found a match either in the current working directory or Gro's directory.
		const path_data = find_modules_result.source_id_path_data_by_input_path.get(input_path)!; // this is null safe because result is ok
		if (!path_data.is_directory) {
			// The input path matches a file, so load and run it.

			// First ensure that the project has been built.
			// This is useful for initial project setup and CI.
			if (await should_build_project(fs, path_data.id)) {
				// Import these lazily to avoid importing their comparatively heavy transitive dependencies
				// every time a task is invoked.
				if (dev !== undefined) {
					// TODO include this?
					throw Error(
						'Invalid `invoke_task` call with a `dev` argument and unbuilt project.' +
							' This probably means Gro or a task made something weird happen.',
					);
				}
				log.info('building project to run task');
				const timingToLoadConfig = timings.start('load config');
				// TODO probably do this as a separate process
				// also this is messy, the `load_config` does some hacky config loading,
				// and then we end up building twice - can it be done in a single pass?
				const {load_config} = await import('../config/config.js');
				const bootstrapping_dev = true; // this does not inherit from the `dev` arg or `process.env.NODE_ENV`
				const config = await load_config(fs, bootstrapping_dev);
				timingToLoadConfig();
				const timing_to_build_project = timings.start('build project');
				const {build_source_directory} = await import('../build/build_source_directory.js');
				await build_source_directory(fs, config, bootstrapping_dev, log);
				timing_to_build_project();
			}

			// Load and run the task.
			const load_modules_result = await load_modules(
				find_modules_result.source_ids_by_input_path,
				load_task_module,
			);
			if (load_modules_result.ok) {
				timings.merge(load_modules_result.timings);
				// Run the task!
				// `path_data` is not a directory, so there's a single task module here.
				const task = load_modules_result.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${
						(task.mod.task.description && gray(task.mod.task.description)) || ''
					}`,
				);
				const timingToRunTask = timings.start('run task');
				const result = await run_task(fs, task, args, events, invoke_task, dev);
				timingToRunTask();
				if (result.ok) {
					log.info(`✓ ${cyan(task.name)}`);
				} else {
					log.info(`${red('🞩')} ${cyan(task.name)}`);
					logErrorReasons(log, [result.reason]);
					throw result.error;
				}
			} else {
				logErrorReasons(log, load_modules_result.reasons);
				process.exit(1);
			}
		} else {
			// The input path matches a directory. Log the tasks but don't run them.
			if (is_this_project_gro) {
				// Is the Gro directory the same as the cwd? Log the matching files.
				logAvailableTasks(
					log,
					print_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else if (is_gro_id(path_data.id)) {
				// Does the Gro directory contain the matching files? Log them.
				logAvailableTasks(
					log,
					print_path_or_gro_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else {
				// The Gro directory is not the same as the cwd
				// and it doesn't contain the matching files.
				// Find all of the possible matches in the Gro directory as well,
				// and log everything out.
				const gro_dirInputPath = replace_root_dir(input_path, gro_paths.root);
				const gro_dirFind_Modules_Result = await find_modules(fs, [gro_dirInputPath], (id) =>
					fs.find_files(id, (file) => is_task_path(file.path)),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (gro_dirFind_Modules_Result.ok) {
					timings.merge(gro_dirFind_Modules_Result.timings);
					const groPath_Data = gro_dirFind_Modules_Result.source_id_path_data_by_input_path.get(
						gro_dirInputPath,
					)!;
					// First log the Gro matches.
					logAvailableTasks(
						log,
						print_path_or_gro_path(groPath_Data.id),
						gro_dirFind_Modules_Result.source_ids_by_input_path,
					);
				}
				// Then log the current working directory matches.
				logAvailableTasks(
					log,
					print_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
				);
			}
		}
	} else if (find_modules_result.type === 'input_directories_with_no_files') {
		// The input path matched a directory, but it contains no matching files.
		if (
			is_this_project_gro ||
			// this is null safe because of the failure type
			is_gro_id(find_modules_result.source_id_path_data_by_input_path.get(input_path)!.id)
		) {
			// If the directory is inside Gro, just log the errors.
			logErrorReasons(log, find_modules_result.reasons);
			process.exit(1);
		} else {
			// If there's a matching directory in the current working directory,
			// but it has no matching files, we still want to search Gro's directory.
			const gro_dirInputPath = replace_root_dir(input_path, gro_paths.root);
			const gro_dirFind_Modules_Result = await find_modules(fs, [gro_dirInputPath], (id) =>
				fs.find_files(id, (file) => is_task_path(file.path)),
			);
			if (gro_dirFind_Modules_Result.ok) {
				timings.merge(gro_dirFind_Modules_Result.timings);
				const groPath_Data = gro_dirFind_Modules_Result.source_id_path_data_by_input_path.get(
					gro_dirInputPath,
				)!;
				// Log the Gro matches.
				logAvailableTasks(
					log,
					print_path_or_gro_path(groPath_Data.id),
					gro_dirFind_Modules_Result.source_ids_by_input_path,
				);
			} else {
				// Log the original errors, not the Gro-specific ones.
				logErrorReasons(log, find_modules_result.reasons);
				process.exit(1);
			}
		}
	} else {
		// Some other find modules result failure happened, so log it out.
		// (currently, just "unmappedInputPaths")
		logErrorReasons(log, find_modules_result.reasons);
		process.exit(1);
	}

	print_timings(timings, log);
	log.info(`🕒 ${printMs(total_timing())}`);
};

const logAvailableTasks = (
	log: Logger,
	dirLabel: string,
	source_ids_by_input_path: Map<string, string[]>,
): void => {
	const source_ids = Array.from(source_ids_by_input_path.values()).flat();
	if (source_ids.length) {
		log.info(`${source_ids.length} task${plural(source_ids.length)} in ${dirLabel}:`);
		for (const source_id of source_ids) {
			log.info(
				'\t' + cyan(to_task_name(source_id_to_base_path(source_id, paths_from_id(source_id)))),
			);
		}
	} else {
		log.info(`No tasks found in ${dirLabel}.`);
	}
};

const logErrorReasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(reason);
	}
};

// This is a best-effort heuristic that quickly detects if
// we should compile a project's TypeScript when invoking a task.
// Properly detecting this is too expensive and would slow task startup time significantly.
// Generally speaking, the developer is expected to be running `gro dev` to keep the build fresh.
// TODO improve this, possibly using `mtime` with the Filer updating directory `mtime` on compile
const should_build_project = async (fs: Filesystem, source_id: string): Promise<boolean> => {
	// don't try to compile Gro's own codebase from outside of it
	if (!is_this_project_gro && is_gro_id(source_id)) return false;
	// if this is Gro, ensure the build directory exists, because tests aren't in dist/
	if (is_this_project_gro && !(await fs.exists(paths.build))) return true;
	// ensure the build file for the source id exists in the default dev build
	const build_id = to_import_id(source_id, true, SYSTEM_BUILD_NAME);
	return !(await fs.exists(build_id));
};
