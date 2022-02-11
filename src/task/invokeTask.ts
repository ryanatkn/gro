import {cyan, red, gray} from 'kleur/colors';
import {SystemLogger, printLogLabel} from '@feltcoop/felt/util/log.js';
import {EventEmitter} from 'events';
import {createStopwatch, Timings} from '@feltcoop/felt/util/timings.js';
import {printMs, printTimings} from '@feltcoop/felt/util/print.js';
import {spawn} from '@feltcoop/felt/util/process.js';

import {serializeArgs, type Args} from '../utils/args.js';
import {runTask} from './runTask.js';
import {resolveRawInputPath, getPossibleSourceIds} from '../fs/inputPath.js';
import {TASK_FILE_SUFFIX, isTaskPath} from './task.js';
import {
	paths,
	groPaths,
	replaceRootDir,
	isGroId,
	toImportId,
	isThisProjectGro,
	printPath,
	printPathOrGroPath,
} from '../paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {loadTaskModule} from './taskModule.js';
import {loadGroPackageJson} from '../utils/packageJson.js';
import {SYSTEM_BUILD_NAME} from '../build/buildConfigDefaults.js';
import {type Filesystem} from '../fs/filesystem.js';
import {logAvailableTasks, logErrorReasons} from './logTask.js';

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

export const invokeTask = async (
	fs: Filesystem,
	taskName: string,
	args: Args,
	events = new EventEmitter(),
): Promise<void> => {
	const log = new SystemLogger(printLogLabel(taskName || 'gro'));

	// Check if the caller just wants to see the version.
	if (!taskName && (args.version || args.v)) {
		const groPackageJson = await loadGroPackageJson(fs);
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
		fs,
		[inputPath],
		(id) => fs.findFiles(id, (file) => isTaskPath(file.path)),
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
			if (await shouldBuildProject(fs, pathData.id)) {
				// Import these lazily to avoid importing their comparatively heavy transitive dependencies
				// every time a task is invoked.
				log.info('building project to run task');
				const timingToLoadConfig = timings.start('load config');
				// TODO probably do this as a separate process
				// also this is messy, the `loadConfig` does some hacky config loading,
				// and then we end up building twice - can it be done in a single pass?
				const {loadConfig} = await import('../config/config.js');
				const config = await loadConfig(fs, true);
				timingToLoadConfig();
				const timingToBuildProject = timings.start('build project');
				const {buildSource} = await import('../build/buildSource.js');
				await buildSource(fs, config, true, log);
				timingToBuildProject();
			}

			// Load and run the task.
			const loadModulesResult = await loadModules(
				findModulesResult.sourceIdsByInputPath,
				true,
				loadTaskModule,
			);
			if (loadModulesResult.ok) {
				timings.merge(loadModulesResult.timings);
				// Run the task!
				// `pathData` is not a directory, so there's a single task module here.
				const task = loadModulesResult.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`,
				);
				const timingToRunTask = timings.start('run task');
				const dev = process.env.NODE_ENV !== 'production'; // TODO should this use `fromEnv`? '$app/env'?
				// If we're in dev mode but the task is only for production, run it in a new process.
				if (dev && task.mod.task.production) {
					// TODO BLOCK
					const result = await spawn('npx', ['gro', taskName, ...serializeArgs(args)], {
						env: {...process.env, NODE_ENV: 'production'},
					});
					timingToRunTask();
					if (result.ok) {
						log.info(`✓ ${cyan(task.name)}`);
					} else {
						log.info(`${red('🞩')} ${cyan(task.name)}`);
						logErrorReasons(log, [
							`spawned task exited with code ${result.code}: ${result.signal}`,
						]);
						throw Error('Spawned task failed');
					}
				} else {
					// Run the task in the current process.
					const result = await runTask(fs, task, args, events, invokeTask);
					timingToRunTask();
					if (result.ok) {
						log.info(`✓ ${cyan(task.name)}`);
					} else {
						log.info(`${red('🞩')} ${cyan(task.name)}`);
						logErrorReasons(log, [result.reason]);
						throw result.error;
					}
				}
			} else {
				logErrorReasons(log, loadModulesResult.reasons);
				process.exit(1);
			}
		} else {
			// The input path matches a directory. Log the tasks but don't run them.
			// eslint-disable-next-line no-lonely-if
			if (isThisProjectGro) {
				// Is the Gro directory the same as the cwd? Log the matching files.
				await logAvailableTasks(
					log,
					printPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
				);
			} else if (isGroId(pathData.id)) {
				// Does the Gro directory contain the matching files? Log them.
				await logAvailableTasks(
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
				const groDirFindModulesResult = await findModules(fs, [groDirInputPath], (id) =>
					fs.findFiles(id, (file) => isTaskPath(file.path)),
				);
				// Ignore any errors - the directory may not exist or have any files!
				if (groDirFindModulesResult.ok) {
					timings.merge(groDirFindModulesResult.timings);
					const groPathData =
						groDirFindModulesResult.sourceIdPathDataByInputPath.get(groDirInputPath)!;
					// First log the Gro matches.
					await logAvailableTasks(
						log,
						printPathOrGroPath(groPathData.id),
						groDirFindModulesResult.sourceIdsByInputPath,
					);
				}
				// Then log the current working directory matches.
				await logAvailableTasks(
					log,
					printPath(pathData.id),
					findModulesResult.sourceIdsByInputPath,
					!groDirFindModulesResult.ok,
				);
			}
		}
	} else if (findModulesResult.type === 'inputDirectoriesWithNoFiles') {
		// The input path matched a directory, but it contains no matching files.
		if (
			isThisProjectGro ||
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
			const groDirFindModulesResult = await findModules(fs, [groDirInputPath], (id) =>
				fs.findFiles(id, (file) => isTaskPath(file.path)),
			);
			if (groDirFindModulesResult.ok) {
				timings.merge(groDirFindModulesResult.timings);
				const groPathData =
					groDirFindModulesResult.sourceIdPathDataByInputPath.get(groDirInputPath)!;
				// Log the Gro matches.
				await logAvailableTasks(
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

	printTimings(timings, log);
	log.info(`🕒 ${printMs(totalTiming())}`);
};

// This is a best-effort heuristic that quickly detects if
// we should compile a project's TypeScript when invoking a task.
// Properly detecting this is too expensive and would slow task startup time significantly.
// Generally speaking, the developer is expected to be running `gro dev` to keep the build fresh.
// TODO improve this, possibly using `mtime` with the Filer updating directory `mtime` on compile
const shouldBuildProject = async (fs: Filesystem, sourceId: string): Promise<boolean> => {
	// don't try to compile Gro's own codebase from outside of it
	if (!isThisProjectGro && isGroId(sourceId)) return false;
	// if this is Gro, ensure the build directory exists, because tests aren't in dist/
	if (isThisProjectGro && !(await fs.exists(paths.build))) return true;
	// ensure the build file for the source id exists in the default dev build
	const buildId = toImportId(sourceId, true, SYSTEM_BUILD_NAME);
	return !(await fs.exists(buildId));
};
