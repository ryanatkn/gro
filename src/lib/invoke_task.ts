import {cyan, red, gray, yellow} from 'kleur/colors';
import {Logger, System_Logger, print_log_label} from '@ryanatkn/belt/log.js';
import {create_stopwatch, Timings} from '@ryanatkn/belt/timings.js';
import {print_ms, print_timings} from '@ryanatkn/belt/print.js';

import {to_forwarded_args, type Args} from './args.js';
import {run_task} from './run_task.js';
import {Input_Path, to_input_path, to_gro_input_path, Raw_Input_Path} from './input_path.js';
import {is_task_path} from './task.js';
import {is_gro_id, IS_THIS_GRO, print_path, print_path_or_gro_path} from './paths.js';
import {find_modules, load_modules, type Find_Modules_Result} from './modules.js';
import {find_task_modules, load_task_module} from './task_module.js';
import {load_gro_package_json} from './package_json.js';
import {print_tasks, print_error_reasons} from './print_task.js';
import {search_fs} from './search_fs.js';
import type {Gro_Config} from './config.js';

/**
 * Invokes Gro tasks by name using the filesystem as the source.
 *
 * When a task is invoked,
 * Gro first searches for tasks in the current working directory.
 * and falls back to searching Gro's directory, if the two are different.
 * See `src/lib/input_path.ts` for info about what "task_name" can refer to.
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
	task_name: Raw_Input_Path,
	args: Args,
	config: Gro_Config,
	timings = new Timings(),
): Promise<void> => {
	const log = new System_Logger(print_log_label(task_name || 'gro'));
	log.info('invoking', task_name ? cyan(task_name) : 'gro');

	const total_timing = create_stopwatch();

	// Check if the caller just wants to see the version.
	if (!task_name && (args.version || args.v)) {
		const gro_package_json = await load_gro_package_json();
		log.info(`${gray('v')}${cyan(gro_package_json.version)}`);
		log.info(`🕒 ${print_ms(total_timing())}`);
		return;
	}

	// TODO BLOCK load config, and probably pass it downstream
	// Resolve the input path for the provided task name.
	const input_path = to_input_path(task_name);
	console.log(cyan(`[invoke_task] input_path`), input_path);

	// Find the task or directory specified by the `input_path`.
	// Fall back to searching the Gro directory as well.
	const find_modules_result = await find_task_modules([input_path], config.task_paths);
	console.log(cyan(`[invoke_task] find_task_modules result`), find_modules_result);
	if (!find_modules_result.ok) {
		if (find_modules_result.type === 'input_directories_with_no_files') {
			// The input path matched a directory, but it contains no matching files.
			console.log(
				yellow(`// The input path matched a directory, but it contains no matching files.`),
			);
			if (
				IS_THIS_GRO ||
				// this is null safe because of the failure type
				is_gro_id(find_modules_result.source_id_path_data_by_input_path.get(input_path)!.id)
			) {
				// If the directory is inside Gro, just log the errors.
				console.log(yellow(`// If the directory is inside Gro, just log the errors.`));
				print_error_reasons(log, find_modules_result.reasons);
				process.exit(1);
			} else {
				// If there's a matching directory in the current working directory,
				// but it has no matching files, we still want to search Gro's directory.
				console.log(
					yellow(
						`// If there's a matching directory in the current working directory, but it has no matching files, we still want to search Gro's directory.`,
					),
				);
				const gro_dir_find_modules_result = await log_gro_package_tasks(input_path, log);
				// TODO BLOCK this doesn't seem to be working as commented, test this condition in another repo (maybe like "gro sync" when there's a "src/lib/sync" folder)
				if (!gro_dir_find_modules_result.ok) {
					// Log the original errors, not the Gro-specific ones.
					console.log(yellow(`// Log the original errors, not the Gro-specific ones.`));
					print_error_reasons(log, find_modules_result.reasons);
					process.exit(1);
				}
			}
		} else {
			// Some unknown find modules result failure happened, so log it out.
			// (currently, just "unmapped_input_paths")
			console.log(yellow(`// Some unknown find modules result failure happened, so log it out.`));
			print_error_reasons(log, find_modules_result.reasons);
			process.exit(1);
		}
	}

	// Found a match either in the current working directory or Gro's directory.
	console.log(
		yellow(`// Found a match either in the current working directory or Gro's directory.`),
	);
	const path_data = find_modules_result.source_id_path_data_by_input_path.get(input_path)!; // this is null safe because result is ok

	if (!path_data.isDirectory) {
		// The input path matches a file, so load and run it.
		console.log(yellow(`// The input path matches a file, so load and run it.`));

		// Try to load the task module.
		const load_modules_result = await load_modules(
			find_modules_result.source_ids_by_input_path,
			load_task_module,
		);
		if (load_modules_result.ok) {
			// We found a task module. Run it!
			// `path_data` is not a directory, so there's a single task module here.
			console.log(yellow(`// We found a task module. Run it!`));
			const task = load_modules_result.modules[0];
			log.info(
				`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`,
			);

			const timing_to_run_task = timings.start('run task ' + task_name);
			const result = await run_task(
				task,
				{...args, ...to_forwarded_args(`gro ${task.name}`)},
				invoke_task,
				config,
				timings,
			);
			timing_to_run_task();
			if (result.ok) {
				log.info(`✓ ${cyan(task.name)}`);
			} else {
				log.info(`${red('🞩')} ${cyan(task.name)}`);
				print_error_reasons(log, [result.reason]);
				throw result.error;
			}
		} else {
			console.log(yellow(`no task module found`));
			print_error_reasons(log, load_modules_result.reasons);
			process.exit(1);
		}
	} else {
		// The input path matches a directory. Log the tasks but don't run them.
		if (IS_THIS_GRO) {
			// Is the Gro directory the same as the cwd? Log the matching files.
			console.log(yellow(`// Is the Gro directory the same as the cwd? Log the matching files.`));
			await print_tasks(
				log,
				print_path(path_data.id),
				find_modules_result.source_ids_by_input_path,
			);
		} else if (is_gro_id(path_data.id)) {
			// TODO BLOCK delete this? merge behavior with the block above/below?
			// Does the Gro directory contain the matching files? Log them.
			console.log(yellow(`// Does the Gro directory contain the matching files? Log them.`));
			await print_tasks(
				log,
				print_path_or_gro_path(path_data.id),
				find_modules_result.source_ids_by_input_path,
			);
		} else {
			// The Gro directory is not the same as the cwd and it doesn't contain the matching files.
			// Find all of the possible matches in the Gro directory as well,
			// and log everything out.
			// Ignore any errors - the directory may not exist or have any files!
			console.log(
				yellow(
					`// The Gro directory is not the same as the cwd and it doesn't contain the matching files.`,
				),
			);
			const gro_dir_find_modules_result = await log_gro_package_tasks(input_path, log);
			// Then log the current working directory matches.
			await print_tasks(
				log,
				print_path(path_data.id),
				find_modules_result.source_ids_by_input_path,
				!gro_dir_find_modules_result.ok,
			);
		}
	}

	print_timings(timings, log);
	log.info(`🕒 ${print_ms(total_timing())}`);
};

const log_gro_package_tasks = async (
	input_path: Input_Path,
	log: Logger,
): Promise<Find_Modules_Result> => {
	const gro_dir_input_path = to_gro_input_path(input_path);
	// TODO BLOCK review
	const gro_dir_find_modules_result = await find_modules([gro_dir_input_path], (id) =>
		search_fs(id, {filter: (path) => is_task_path(path)}),
	);
	if (gro_dir_find_modules_result.ok) {
		const gro_path_data =
			gro_dir_find_modules_result.source_id_path_data_by_input_path.get(gro_dir_input_path)!;
		// Log the Gro matches.
		await print_tasks(
			log,
			print_path_or_gro_path(gro_path_data.id),
			gro_dir_find_modules_result.source_ids_by_input_path,
		);
	}
	console.log(cyan(`[invoke_task] gro_dir_find_modules_result`), gro_dir_find_modules_result);
	return gro_dir_find_modules_result;
};
