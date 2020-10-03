import {magenta, cyan, red, gray} from '../colors/terminal.js';
import {compileSourceDirectory} from '../compile/compileSourceDirectory.js';
import {Args} from '../cli/types';
import {SystemLogger, Logger} from '../utils/log.js';
import {runTask} from './runTask.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {printMs, printPath, printPathOrGroPath, printTiming} from '../utils/print.js';
import {resolveRawInputPath, getPossibleSourceIds} from '../fs/inputPath.js';
import {TASK_FILE_SUFFIX, isTaskPath, toTaskName, TaskError} from './task.js';
import {
	paths,
	groPaths,
	toBasePath,
	replaceRootDir,
	pathsFromId,
	isGroId,
	toImportId,
} from '../paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {findFiles, pathExists} from '../fs/nodeFs.js';
import {plural} from '../utils/string.js';
import {loadTaskModule} from './taskModule.js';
import {PathData} from '../fs/pathData.js';
import {getGroPackageJson} from '../project/packageJson.js';
import {loadBuildConfigs} from '../project/buildConfig.js';

/*

This module invokes Gro tasks by name using the filesystem as the source.

When a task is invoked,
it first searches for tasks in the current working directory.
and falls back to searching Gro's directory, if the two are different.
See `src/fs/inputPath.ts` for info about what "taskName" can refer to.
If it matches a directory, all of the tasks within it are logged,
both in the current working directory and Gro.

This code is particularly hairy because
we're accepting a wide range of user input
and trying to do the right thing.
Precise error messages are especially difficult and
there are some subtle differences in the complex logical branches.
The comments describe each condition.

*/

export const invokeTask = async (taskName: string, args: Args): Promise<void> => {
	const log = new SystemLogger([`${gray('[')}${magenta(taskName || 'gro')}${gray(']')}`]);

	// Check if the caller just wants to see the version.
	if (!taskName && (args.version || args.v)) {
		const groPackageJson = await getGroPackageJson();
		log.info(`${gray('v')}${cyan(groPackageJson.version as string)}`);
		return;
	}

	const totalTiming = createStopwatch();
	const timings = new Timings();

	// Resolve the input path for the provided task name.
	const inputPath = resolveRawInputPath(taskName || paths.source);

	// Find the task or directory specified by the `inputPath`.
	// Fall back to searching the Gro directory as well.
	const findModulesResult = await findModules(
		[inputPath],
		(id) => findFiles(id, (file) => isTaskPath(file.path)),
		(inputPath) => getPossibleSourceIds(inputPath, [TASK_FILE_SUFFIX], [groPaths.root]),
	);

	if (findModulesResult.ok) {
		timings.merge(findModulesResult.timings);
		// Found a match either in the current working directory or Gro's directory.
		const pathData = findModulesResult.sourceIdPathDataByInputPath.get(inputPath)!; // this is null safe because result is ok
		if (!pathData.isDirectory) {
			// The input path matches a file, so load and run it.

			// First ensure that the project has been built.
			// This is useful for initial project setup and CI.
			if (await shouldBuildProject(pathData)) {
				log.info('Task file not found in build directory. Compiling TypeScript...');
				const timingToBuildProject = timings.start('build project');
				await compileSourceDirectory(await loadBuildConfigs(), true, log);
				timingToBuildProject();
			}

			// Load and run the task.
			const loadModulesResult = await loadModules(
				findModulesResult.sourceIdsByInputPath,
				loadTaskModule,
			);
			if (loadModulesResult.ok) {
				timings.merge(loadModulesResult.timings);
				// Run the task!
				// `pathData` is not a directory, so there's a single task module here.
				const task = loadModulesResult.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${
						(task.mod.task.description && gray(task.mod.task.description)) || ''
					}`,
				);
				const timingToRunTask = timings.start('run task');
				const result = await runTask(task, args, invokeTask);
				timingToRunTask();
				if (result.ok) {
					log.info(`✓ ${cyan(task.name)}`);
				} else {
					log.info(`${red('🞩')} ${cyan(task.name)}`);
					logErrorReasons(log, [result.reason]);
					if (result.error instanceof TaskError) {
						process.exit(1);
					} else {
						throw result.error;
					}
				}
			} else {
				logErrorReasons(log, loadModulesResult.reasons);
				process.exit(1);
			}
		} else {
			// The input path matches a directory. Log the tasks but don't run them.
			if (paths === groPaths) {
				// Is the Gro directory the same as the cwd? Log the matching files.
				logAvailableTasks(log, printPath(pathData.id), findModulesResult.sourceIdsByInputPath);
			} else if (isGroId(pathData.id)) {
				// Does the Gro directory contain the matching files? Log them.
				logAvailableTasks(
					log,
					printPathOrGroPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
				);
			} else {
				// The Gro directory is not the same as the cwd
				// and it doesn't contain the matching files.
				// Find all of the possible matches in the Gro directory as well,
				// and log everything out.
				const groDirInputPath = replaceRootDir(inputPath, groPaths.root);
				const groDirFindModulesResult = await findModules([groDirInputPath], (id) =>
					findFiles(id, (file) => isTaskPath(file.path)),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (groDirFindModulesResult.ok) {
					timings.merge(groDirFindModulesResult.timings);
					const groPathData = groDirFindModulesResult.sourceIdPathDataByInputPath.get(
						groDirInputPath,
					)!;
					// First log the Gro matches.
					logAvailableTasks(
						log,
						printPathOrGroPath(groPathData.id),
						groDirFindModulesResult.sourceIdsByInputPath,
					);
				}
				// Then log the current working directory matches.
				logAvailableTasks(log, printPath(pathData.id), findModulesResult.sourceIdsByInputPath);
			}
		}
	} else if (findModulesResult.type === 'inputDirectoriesWithNoFiles') {
		// The input path matched a directory, but it contains no matching files.
		if (
			paths === groPaths ||
			// this is null safe because of the failure type
			isGroId(findModulesResult.sourceIdPathDataByInputPath.get(inputPath)!.id)
		) {
			// If the directory is inside Gro, just log the errors.
			logErrorReasons(log, findModulesResult.reasons);
			process.exit(1);
		} else {
			// If there's a matching directory in the current working directory,
			// but it has no matching files, we still want to search Gro's directory.
			const groDirInputPath = replaceRootDir(inputPath, groPaths.root);
			const groDirFindModulesResult = await findModules([groDirInputPath], (id) =>
				findFiles(id, (file) => isTaskPath(file.path)),
			);
			if (groDirFindModulesResult.ok) {
				timings.merge(groDirFindModulesResult.timings);
				const groPathData = groDirFindModulesResult.sourceIdPathDataByInputPath.get(
					groDirInputPath,
				)!;
				// Log the Gro matches.
				logAvailableTasks(
					log,
					printPathOrGroPath(groPathData.id),
					groDirFindModulesResult.sourceIdsByInputPath,
				);
			} else {
				// Log the original errors, not the Gro-specific ones.
				logErrorReasons(log, findModulesResult.reasons);
				process.exit(1);
			}
		}
	} else {
		// Some other find modules result failure happened, so log it out.
		// (currently, just "unmappedInputPaths")
		logErrorReasons(log, findModulesResult.reasons);
		process.exit(1);
	}

	for (const [key, timing] of timings.getAll()) {
		log.trace(printTiming(key, timing));
	}
	log.info(`🕒 ${printMs(totalTiming())}`);
};

const logAvailableTasks = (
	log: Logger,
	dirLabel: string,
	sourceIdsByInputPath: Map<string, string[]>,
): void => {
	const sourceIds = Array.from(sourceIdsByInputPath.values()).flat();
	if (sourceIds.length) {
		log.info(`${sourceIds.length} task${plural(sourceIds.length)} in ${dirLabel}:`);
		for (const sourceId of sourceIds) {
			log.info('\t' + cyan(toTaskName(toBasePath(sourceId, pathsFromId(sourceId)))));
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

// This is a best-effort heuristic that detects if
// we should compile a project's TypeScript when invoking a task.
// Properly detecting this is too expensive and would impact startup time significantly.
// Generally speaking, the user is expected to be running `gro dev` or `gro build`.
const shouldBuildProject = async (pathData: PathData): Promise<boolean> => {
	const id = paths !== groPaths && isGroId(pathData.id) ? paths.build : toImportId(pathData.id);
	return !(await pathExists(id));
};
