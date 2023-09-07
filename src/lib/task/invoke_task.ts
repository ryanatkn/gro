import {cyan, red, gray} from 'kleur/colors';
import {EventEmitter} from 'node:events';
import {SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {printMs, printTimings} from '@feltjs/util/print.js';

import {toForwardedArgs, type Args} from './args.js';
import {run_task} from './run_task.js';
import {resolveRawInputPath} from '../path/inputPath.js';
import {isTaskPath} from './task.js';
import {
	paths,
	gro_paths,
	replace_root_dir,
	is_gro_id,
	is_this_project_gro,
	print_path,
	print_path_or_gro_path,
} from '../path/paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {findTaskModules, load_task_module} from './task_module.js';
import {loadGroPackageJson} from '../util/packageJson.js';
import type {Filesystem} from '../fs/filesystem.js';
import {log_available_tasks, log_error_reasons} from './log_task.js';

/**
 * Invokes Gro tasks by name using the filesystem as the source.
 *
 * When a task is invoked,
 * Gro first searches for tasks in the current working directory.
 * and falls back to searching Gro's directory, if the two are different.
 * See `src/lib/path/inputPath.ts` for info about what "taskName" can refer to.
 * If it matches a directory, all of the tasks within it are logged,
 * both in the current working directory and Gro.
 *
 * This code is particularly hairy because
 * we're accepting a wide range of user input
 * and trying to do the right thing.
 * Precise error messages are especially difficult and
 * there are some subtle differences in the complex logical branches.
 * The comments describe each condition.
 */
export const invoke_task = async (
	fs: Filesystem,
	taskName: string,
	args: Args,
	events = new EventEmitter(),
): Promise<void> => {
	const log = new SystemLogger(printLogLabel(taskName || 'gro'));
	SystemLogger.level = 'debug'; // TODO BLOCK remove this
	log.info('invoking');

	// Check if the caller just wants to see the version.
	if (!taskName && (args.version || args.v)) {
		const groPackageJson = await loadGroPackageJson(fs);
		log.info(`${gray('v')}${cyan(groPackageJson.version as string)}`);
		return;
	}

	const total_timing = createStopwatch();
	const timings = new Timings();

	// Resolve the input path for the provided task name.
	const inputPath = resolveRawInputPath(taskName || paths.lib);
	console.log(`inputPath`, inputPath);

	// Find the task or directory specified by the `inputPath`.
	// Fall back to searching the Gro directory as well.
	const find_modules_result = await findTaskModules(fs, [inputPath], undefined, [gro_paths.root]);
	console.log(`find_modules_result`, find_modules_result);
	if (find_modules_result.ok) {
		// Found a match either in the current working directory or Gro's directory.
		timings.merge(find_modules_result.timings);
		const pathData = find_modules_result.source_idPathDataByInputPath.get(inputPath)!; // this is null safe because result is ok
		console.log(`pathData`, pathData);

		if (!pathData.isDirectory) {
			// The input path matches a file, so load and run it.

			// Try to load the task module.
			// TODO BLOCK why not loadTaskModules ? get good error messages too
			console.log('LOADING', Array.from(find_modules_result.source_ids_by_input_path.entries()));
			const load_modules_result = await loadModules(
				find_modules_result.source_ids_by_input_path,
				true,
				load_task_module,
			);
			if (load_modules_result.ok) {
				// We found a task module. Run it!
				timings.merge(load_modules_result.timings);
				// `pathData` is not a directory, so there's a single task module here.
				const task = load_modules_result.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`,
				);
				const timingToRunTask = timings.start('run task');
				console.log(`toForwardedArgs`, toForwardedArgs(`gro ${task.name}`));
				const result = await run_task(
					fs,
					task,
					{...args, ...toForwardedArgs(`gro ${task.name}`)},
					events,
					invoke_task,
				);
				timingToRunTask();
				if (result.ok) {
					log.info(`✓ ${cyan(task.name)}`);
				} else {
					log.info(`${red('🞩')} ${cyan(task.name)}`);
					log_error_reasons(log, [result.reason]);
					throw result.error;
				}
			} else {
				log_error_reasons(log, load_modules_result.reasons);
				process.exit(1);
			}
		} else {
			// The input path matches a directory. Log the tasks but don't run them.
			if (is_this_project_gro) {
				// Is the Gro directory the same as the cwd? Log the matching files.
				await log_available_tasks(
					log,
					print_path(pathData.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else if (is_gro_id(pathData.id)) {
				// Does the Gro directory contain the matching files? Log them.
				await log_available_tasks(
					log,
					print_path_or_gro_path(pathData.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else {
				// The Gro directory is not the same as the cwd
				// and it doesn't contain the matching files.
				// Find all of the possible matches in the Gro directory as well,
				// and log everything out.
				const gro_dir_input_path = replace_root_dir(inputPath, gro_paths.root);
				const gro_dir_find_modules_result = await findModules(fs, [gro_dir_input_path], (id) =>
					fs.findFiles(id, (path) => isTaskPath(path)),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (gro_dir_find_modules_result.ok) {
					timings.merge(gro_dir_find_modules_result.timings);
					const groPathData =
						gro_dir_find_modules_result.source_idPathDataByInputPath.get(gro_dir_input_path)!;
					// First log the Gro matches.
					await log_available_tasks(
						log,
						print_path_or_gro_path(groPathData.id),
						gro_dir_find_modules_result.source_ids_by_input_path,
					);
				}
				// Then log the current working directory matches.
				await log_available_tasks(
					log,
					print_path(pathData.id),
					find_modules_result.source_ids_by_input_path,
					!gro_dir_find_modules_result.ok,
				);
			}
		}
	} else if (find_modules_result.type === 'inputDirectoriesWithNoFiles') {
		// The input path matched a directory, but it contains no matching files.
		if (
			is_this_project_gro ||
			// this is null safe because of the failure type
			is_gro_id(find_modules_result.source_idPathDataByInputPath.get(inputPath)!.id)
		) {
			// If the directory is inside Gro, just log the errors.
			log_error_reasons(log, find_modules_result.reasons);
			process.exit(1);
		} else {
			// If there's a matching directory in the current working directory,
			// but it has no matching files, we still want to search Gro's directory.
			const gro_dir_input_path = replace_root_dir(inputPath, gro_paths.root);
			const gro_dir_find_modules_result = await findModules(fs, [gro_dir_input_path], (id) =>
				fs.findFiles(id, (path) => isTaskPath(path)),
			);
			if (gro_dir_find_modules_result.ok) {
				timings.merge(gro_dir_find_modules_result.timings);
				const groPathData =
					gro_dir_find_modules_result.source_idPathDataByInputPath.get(gro_dir_input_path)!;
				// Log the Gro matches.
				await log_available_tasks(
					log,
					print_path_or_gro_path(groPathData.id),
					gro_dir_find_modules_result.source_ids_by_input_path,
				);
			} else {
				// Log the original errors, not the Gro-specific ones.
				log_error_reasons(log, find_modules_result.reasons);
				process.exit(1);
			}
		}
	} else {
		// Some other find modules result failure happened, so log it out.
		// (currently, just "unmappedInputPaths")
		log_error_reasons(log, find_modules_result.reasons);
		process.exit(1);
	}

	printTimings(timings, log);
	log.info(`🕒 ${printMs(total_timing())}`);
};
