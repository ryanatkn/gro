import {cyan, red, gray} from 'kleur/colors';
import {EventEmitter} from 'node:events';
import {SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {printMs, printTimings} from '@feltjs/util/print.js';

import {to_forwarded_args, type Args} from './args.js';
import {run_task} from './run_task.js';
import {resolveRawInputPath} from '../path/input_path.js';
import {is_task_path} from './task.js';
import {
	paths,
	gro_paths,
	replace_root_dir,
	is_gro_id,
	is_this_project_gro,
	print_path,
	print_path_or_gro_path,
} from '../path/paths.js';
import {find_modules, load_modules} from '../fs/modules.js';
import {find_task_modules, load_task_module} from './task_module.js';
import {load_gro_package_json} from '../util/package_json.js';
import type {Filesystem} from '../fs/filesystem.js';
import {log_available_tasks, log_error_reasons} from './log_task.js';
import {sveltekit_sync} from '../util/sveltekit_sync.js';

/**
 * Invokes Gro tasks by name using the filesystem as the source.
 *
 * When a task is invoked,
 * Gro first searches for tasks in the current working directory.
 * and falls back to searching Gro's directory, if the two are different.
 * See `src/lib/path/input_path.ts` for info about what "task_name" can refer to.
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
	task_name: string,
	args: Args,
	events = new EventEmitter(),
): Promise<void> => {
	const log = new SystemLogger(printLogLabel(task_name || 'gro'));
	SystemLogger.level = 'debug'; // TODO BLOCK remove this
	log.info('invoking', cyan(task_name));

	// This is wasteful sometimes, but we're just going for correctness right now.
	await sveltekit_sync(fs);

	// Check if the caller just wants to see the version.
	if (!task_name && (args.version || args.v)) {
		const gro_package_json = await load_gro_package_json(fs);
		log.info(`${gray('v')}${cyan(gro_package_json.version as string)}`);
		return;
	}

	const total_timing = createStopwatch();
	const timings = new Timings();

	// Resolve the input path for the provided task name.
	const input_path = resolveRawInputPath(task_name || paths.lib);
	console.log(`input_path`, input_path);

	// Find the task or directory specified by the `input_path`.
	// Fall back to searching the Gro directory as well.
	const find_modules_result = await find_task_modules(fs, [input_path], undefined, [
		gro_paths.root,
	]);
	console.log(`find_modules_result`, find_modules_result);
	if (find_modules_result.ok) {
		// Found a match either in the current working directory or Gro's directory.
		timings.merge(find_modules_result.timings);
		const path_data = find_modules_result.source_id_path_data_by_input_path.get(input_path)!; // this is null safe because result is ok
		console.log(`path_data`, path_data);

		if (!path_data.isDirectory) {
			// The input path matches a file, so load and run it.

			// Try to load the task module.
			console.log('LOADING', Array.from(find_modules_result.source_ids_by_input_path.entries()));
			const load_modules_result = await load_modules(
				find_modules_result.source_ids_by_input_path,
				true,
				load_task_module,
			);
			if (load_modules_result.ok) {
				// We found a task module. Run it!
				timings.merge(load_modules_result.timings);
				// `path_data` is not a directory, so there's a single task module here.
				const task = load_modules_result.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`,
				);
				const timingToRunTask = timings.start('run task');
				console.log(`to_forwarded_args`, to_forwarded_args(`gro ${task.name}`));
				const result = await run_task(
					fs,
					task,
					{...args, ...to_forwarded_args(`gro ${task.name}`)},
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
					print_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else if (is_gro_id(path_data.id)) {
				// Does the Gro directory contain the matching files? Log them.
				await log_available_tasks(
					log,
					print_path_or_gro_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
				);
			} else {
				// The Gro directory is not the same as the cwd
				// and it doesn't contain the matching files.
				// Find all of the possible matches in the Gro directory as well,
				// and log everything out.
				const gro_dir_input_path = replace_root_dir(input_path, gro_paths.root);
				const gro_dir_find_modules_result = await find_modules(fs, [gro_dir_input_path], (id) =>
					fs.findFiles(id, (path) => is_task_path(path), undefined, true),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (gro_dir_find_modules_result.ok) {
					timings.merge(gro_dir_find_modules_result.timings);
					const groPathData =
						gro_dir_find_modules_result.source_id_path_data_by_input_path.get(gro_dir_input_path)!;
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
					print_path(path_data.id),
					find_modules_result.source_ids_by_input_path,
					!gro_dir_find_modules_result.ok,
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
			log_error_reasons(log, find_modules_result.reasons);
			process.exit(1);
		} else {
			// If there's a matching directory in the current working directory,
			// but it has no matching files, we still want to search Gro's directory.
			const gro_dir_input_path = replace_root_dir(input_path, gro_paths.root);
			const gro_dir_find_modules_result = await find_modules(fs, [gro_dir_input_path], (id) =>
				fs.findFiles(id, (path) => is_task_path(path), undefined, true),
			);
			if (gro_dir_find_modules_result.ok) {
				timings.merge(gro_dir_find_modules_result.timings);
				const groPathData =
					gro_dir_find_modules_result.source_id_path_data_by_input_path.get(gro_dir_input_path)!;
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
		// (currently, just "unmapped_input_paths")
		log_error_reasons(log, find_modules_result.reasons);
		process.exit(1);
	}

	printTimings(timings, log);
	log.info(`🕒 ${printMs(total_timing())}`);
};
