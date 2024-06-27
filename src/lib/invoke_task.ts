import {cyan, red, gray} from 'kleur/colors';
import {System_Logger, print_log_label} from '@ryanatkn/belt/log.js';
import {create_stopwatch, Timings} from '@ryanatkn/belt/timings.js';
import {print_ms, print_timings} from '@ryanatkn/belt/print.js';

import {to_forwarded_args, type Args} from './args.js';
import {run_task} from './run_task.js';
import {to_input_path, Raw_Input_Path} from './input_path.js';
import {find_tasks, load_tasks} from './task.js';
import {load_gro_package_json} from './package_json.js';
import {log_tasks, log_error_reasons} from './task_logging.js';
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
	args: Args | undefined,
	config: Gro_Config,
	timings = new Timings(),
): Promise<void> => {
	const log = new System_Logger(print_log_label(task_name || 'gro'));
	log.info('invoking', task_name ? cyan(task_name) : 'gro');

	const total_timing = create_stopwatch();
	const finish = () => {
		print_timings(timings, log);
		log.info(`🕒 ${print_ms(total_timing())}`);
	};

	// Check if the caller just wants to see the version.
	if (!task_name && (args?.version || args?.v)) {
		const gro_package_json = await load_gro_package_json();
		log.info(`${gray('v')}${cyan(gro_package_json.version)}`);
		finish();
		return;
	}

	// Resolve the input path for the provided task name.
	const input_path = to_input_path(task_name);

	const {task_root_dirs} = config;

	// Find the task or directory specified by the `input_path`.
	// Fall back to searching the Gro directory as well.
	const found = find_tasks([input_path], task_root_dirs, config);
	if (!found.ok) {
		log_error_reasons(log, found.reasons);
		process.exit(1);
	}

	// Found a match either in the current working directory or Gro's directory.
	const found_tasks = found.value;
	const {resolved_input_files} = found_tasks;

	// Load the task module.
	const loaded = await load_tasks(found_tasks);
	if (!loaded.ok) {
		log_error_reasons(log, loaded.reasons);
		process.exit(1);
	}
	const loaded_tasks = loaded.value;

	if (resolved_input_files.length > 1 || resolved_input_files[0].resolved_input_path.is_directory) {
		// The input path matches a directory. Log the tasks but don't run them.
		await log_tasks(log, loaded_tasks);
		finish();
		return;
	}

	// The input path matches a file that's presumable a task, so load and run it.
	if (loaded_tasks.modules.length !== 1) throw Error('expected one loaded task'); // run only one task at a time
	const task = loaded_tasks.modules[0];
	log.info(`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`);

	const timing_to_run_task = timings.start('run task ' + task_name);
	const result = await run_task(
		task,
		{...args, ...to_forwarded_args(`gro ${task.name}`)},
		invoke_task,
		config,
		timings,
	);
	timing_to_run_task();
	if (!result.ok) {
		log.info(`${red('🞩')} ${cyan(task.name)}`);
		log_error_reasons(log, [result.reason]);
		throw result.error;
	}
	log.info(`✓ ${cyan(task.name)}`);

	finish();
};
