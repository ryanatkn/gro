// handle uncaught errors
import {attachProcessErrorHandlers} from '../utils/process.js';
attachProcessErrorHandlers();

// install source maps
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install({
	handleUncaughtExceptions: false,
});

// set up the env
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

import mri from 'mri';

import {Args} from './types.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {green, blue, cyan, red} from '../colors/terminal.js';
import {runTask} from '../task/runTask.js';
import {Timings} from '../utils/time.js';
import {
	fmtMs,
	fmtError,
	fmtPath,
	fmtPathOrGroPath,
	fmtSubTiming,
} from '../utils/fmt.js';
import {resolveRawInputPath, getPossibleSourceIds} from '../fs/inputPath.js';
import {TASK_FILE_SUFFIX, isTaskPath, toTaskName} from '../task/task.js';
import {
	paths,
	groPaths,
	toBasePath,
	replaceRootDir,
	pathsFromId,
	isId,
} from '../paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {findFiles} from '../fs/nodeFs.js';
import {plural} from '../utils/string.js';
import {loadTaskModule} from '../task/taskModule.js';

/*

This module invokes the Gro CLI.

Tasks are the CLI's primary concept.
To learn more about them, see the docs at `src/task/README.md`.

When the CLI is invoked,
it first searches for tasks in the current working directory
using the first CLI arg a.k.a. "taskName",
and falls back to searching Gro's directory, if the two are different.
See `src/fs/inputPath.ts` for info about what "taskName" can refer to.
If it matches a directory, all of the tasks within it are printed out,
both in the current working directory and Gro.

This code is particularly hairy because
we're accepting a wide range of user input
and trying to do the right thing.
Precise error messages are especially difficult and
there are some subtle differences in the complex logical branches.
The comments describe each condition.

*/
const main = async () => {
	const argv: Args = mri(process.argv.slice(2));
	const log = new SystemLogger([blue(`[${green('gro')}]`)]);

	const {
		_: [taskName, ..._],
		...namedArgs
	} = argv;
	const args = {_, ...namedArgs};

	const timings = new Timings<'total'>();
	timings.start('total');
	const subTimings = new Timings();

	// Resolve the input path for the provided task name.
	const inputPath = resolveRawInputPath(taskName || paths.source);

	// Find the task or directory specified by the `inputPath`.
	// Fall back to searching the Gro directory as well.
	const findModulesResult = await findModules(
		[inputPath],
		id => findFiles(id, file => isTaskPath(file.path)),
		inputPath =>
			getPossibleSourceIds(inputPath, [TASK_FILE_SUFFIX], [groPaths.root]),
	);

	if (findModulesResult.ok) {
		subTimings.merge(findModulesResult.timings);
		// Found a match either in the current working directory or Gro's directory.
		const pathData = findModulesResult.sourceIdPathDataByInputPath.get(
			inputPath,
		)!; // this is null safe because result is ok
		if (!pathData.isDirectory) {
			// The input path matches a file, so load and run it.
			const loadModulesResult = await loadModules(
				findModulesResult.sourceIdsByInputPath,
				loadTaskModule,
			);
			if (loadModulesResult.ok) {
				subTimings.merge(loadModulesResult.timings);
				// Run the task!
				// `pathData` is not a directory, so there's a single task module here.
				const task = loadModulesResult.modules[0];
				log.info(`→ ${cyan(task.name)}`);
				subTimings.start('run task');
				const result = await runTask(task, args, process.env);
				subTimings.stop('run task');
				if (result.ok) {
					log.info(`✓ ${cyan(task.name)}`);
				} else {
					log.info(`${red('🞩')} ${cyan(task.name)}`);
					log.error(result.reason, '\n', fmtError(result.error));
				}
			} else {
				printErrorReasons(log, loadModulesResult.reasons);
			}
		} else {
			// The input path matches a directory. Print the tasks but don't run them.
			if (paths === groPaths) {
				// Is the Gro directory the same as the cwd? Print the matching files.
				printAvailableTasks(
					log,
					fmtPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
				);
			} else if (isId(pathData.id, groPaths)) {
				// Does the Gro directory contain the matching files? Print them.
				printAvailableTasks(
					log,
					fmtPathOrGroPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
				);
			} else {
				// The Gro directory is not the same as the cwd
				// and it doesn't contain the matching files.
				// Find all of the possible matches in the Gro directory as well,
				// and print everything out.
				const groDirInputPath = replaceRootDir(inputPath, groPaths.root);
				const groDirFindModulesResult = await findModules(
					[groDirInputPath],
					id => findFiles(id, file => isTaskPath(file.path)),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (groDirFindModulesResult.ok) {
					subTimings.merge(groDirFindModulesResult.timings);
					const groPathData = groDirFindModulesResult.sourceIdPathDataByInputPath.get(
						groDirInputPath,
					)!;
					// First print the Gro matches.
					printAvailableTasks(
						log,
						fmtPathOrGroPath(groPathData.id),
						groDirFindModulesResult.sourceIdsByInputPath,
					);
				}
				// Then print the current working directory matches.
				printAvailableTasks(
					log,
					fmtPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
				);
			}
		}
	} else if (findModulesResult.type === 'inputDirectoriesWithNoFiles') {
		// The input path matched a directory, but it contains no matching files.
		if (
			paths === groPaths ||
			isId(
				// this is null safe because of the failure type
				findModulesResult.sourceIdPathDataByInputPath.get(inputPath)!.id,
				groPaths,
			)
		) {
			// If the directory is inside Gro, just print the errors.
			printErrorReasons(log, findModulesResult.reasons);
		} else {
			// If there's a matching directory in the current working directory,
			// but it has no matching files, we still want to search Gro's directory.
			const groDirInputPath = replaceRootDir(inputPath, groPaths.root);
			const groDirFindModulesResult = await findModules([groDirInputPath], id =>
				findFiles(id, file => isTaskPath(file.path)),
			);
			if (groDirFindModulesResult.ok) {
				subTimings.merge(groDirFindModulesResult.timings);
				const groPathData = groDirFindModulesResult.sourceIdPathDataByInputPath.get(
					groDirInputPath,
				)!;
				// Print the Gro matches.
				printAvailableTasks(
					log,
					fmtPathOrGroPath(groPathData.id),
					groDirFindModulesResult.sourceIdsByInputPath,
				);
			} else {
				// Print the original errors, not the Gro-specific ones.
				printErrorReasons(log, findModulesResult.reasons);
			}
		}
	} else {
		// Some other find modules result failure happened, so print it out.
		// (currently, just "unmappedInputPaths")
		printErrorReasons(log, findModulesResult.reasons);
	}

	for (const [key, timing] of subTimings.getAll()) {
		log.trace(fmtSubTiming(key, timing));
	}
	log.info(`🕒 ${fmtMs(timings.stop('total'))}`);
};

const printAvailableTasks = (
	log: Logger,
	dirLabel: string,
	sourceIdsByInputPath: Map<string, string[]>,
): void => {
	const sourceIds = Array.from(sourceIdsByInputPath.values()).flat();
	if (sourceIds.length) {
		log.info(
			`${sourceIds.length} task${plural(sourceIds.length)} in ${dirLabel}:`,
		);
		for (const sourceId of sourceIds) {
			log.info(
				'\t' + cyan(toTaskName(toBasePath(sourceId, pathsFromId(sourceId)))),
			);
		}
	} else {
		log.info(`No tasks found in ${dirLabel}.`);
	}
};

const printErrorReasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(reason);
	}
};

main(); // see `attachProcessErrorHandlers` above for why we don't catch here
