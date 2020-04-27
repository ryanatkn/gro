import {blue, magenta, cyan} from '../colors/terminal.js';
import {runTask} from '../task/runTask.js';
import {SystemLogger} from '../utils/log.js';
import {Args} from '../cli/types.js';
import {Timings} from '../utils/time.js';
import {fmtMs, fmtError} from '../utils/fmt.js';
import {TaskModuleMeta, loadTaskModules} from '../task/taskModule.js';
import {resolveRawInputPaths} from '../files/inputPaths.js';
import {TASK_FILE_SUFFIX} from '../task/task.js';

const log = new SystemLogger([blue(`[commands/${magenta('run')}]`)]);
const {info, error} = log;

// Options are done differently here than normal to accept arbitrary CLI flags.
// We still export a consistent external interface
// even though `InitialOptions` and `initOptions` are no-ops.
export type Options = Args;
export type InitialOptions = Options;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {
		_: [taskName, ..._],
		...namedArgs
	} = options;
	const args = {_, ...namedArgs};

	const timings = new Timings<'total' | 'run task'>();
	timings.start('total');

	// If no task name is provided,
	// find all of the available ones and print them out.
	if (!taskName) {
		const loadResult = await loadTaskModules();
		if (!loadResult.ok) {
			for (const reason of loadResult.reasons) {
				error(reason);
			}
			return;
		}
		const tasks = loadResult.modules;
		printAvailableTasks(tasks);
		info(`🕒 ${fmtMs(timings.stop('total'))}`);
		return;
	}

	// Resolve the input path for the provided task name.
	const inputPaths = resolveRawInputPaths([taskName]);

	// Load the specified task.
	const loadResult = await loadTaskModules(inputPaths, [TASK_FILE_SUFFIX]);
	if (!loadResult.ok) {
		for (const reason of loadResult.reasons) {
			error(reason);
		}
		return;
	}

	// Was more than one task found? If so print them out but don't run anything.
	// If one task was found, ensure that the input path matches it exactly.
	// It's surprising behavior to execute a task just by a directory!
	// If no tasks were found, it errors and exits above.
	if (
		loadResult.modules.length !== 1 ||
		(loadResult.modules[0].id !== inputPaths[0] &&
			loadResult.modules[0].id !== inputPaths[0] + TASK_FILE_SUFFIX)
	) {
		printAvailableTasks(loadResult.modules);
		info(`🕒 ${fmtMs(timings.stop('total'))}`);
		return;
	}

	const task = loadResult.modules[0];

	// Run the task.
	info(`→ ${cyan(task.name)}`);
	timings.start('run task');
	const result = await runTask(task, args);
	timings.stop('run task');
	info(`✓ ${cyan(task.name)}`);

	if (!result.ok) {
		error(result.reason, '\n', fmtError(result.error));
	}

	info(
		`${fmtMs(loadResult.timings.get('map input paths'))} to map input paths`,
	);
	info(`${fmtMs(loadResult.timings.get('find files'))} to find files`);
	info(`${fmtMs(loadResult.timings.get('load modules'))} to load modules`);
	info(`${fmtMs(timings.get('run task'))} to run task`);
	info(`🕒 ${fmtMs(timings.stop('total'))}`);
};

const printAvailableTasks = (tasks: TaskModuleMeta[]) => {
	if (tasks.length) {
		info(
			'Available tasks:\n',
			tasks.map(t => '\t\t' + cyan(t.name)).join('\n'),
		);
	} else {
		info('No tasks found.');
	}
};
