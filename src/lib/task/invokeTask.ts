import {cyan, red, gray} from 'kleur/colors';
import {EventEmitter} from 'node:events';
import {SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {printMs, printTimings} from '@feltjs/util/print.js';

import {toForwardedArgs, type Args} from '../task/args.js';
import {runTask} from './runTask.js';
import {resolveRawInputPath} from '../path/inputPath.js';
import {isTaskPath} from './task.js';
import {
	paths,
	groPaths,
	replaceRootDir,
	isGroId,
	isThisProjectGro,
	printPath,
	printPathOrGroPath,
} from '../path/paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {findTaskModules, loadTaskModule} from './taskModule.js';
import {loadGroPackageJson} from '../util/packageJson.js';
import type {Filesystem} from '../fs/filesystem.js';
import {logAvailableTasks, logErrorReasons} from './logTask.js';
import {loadConfig} from '../config/config.js';
import {buildSource} from '../build/buildSource.js';

let built = false;

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
export const invokeTask = async (
	fs: Filesystem,
	taskName: string,
	args: Args,
	events = new EventEmitter(),
): Promise<void> => {
	const log = new SystemLogger(printLogLabel(taskName || 'gro'));
	SystemLogger.level = 'debug'; // TODO BLOCK remove this

	// Check if the caller just wants to see the version.
	if (!taskName && (args.version || args.v)) {
		const groPackageJson = await loadGroPackageJson(fs);
		log.info(`${gray('v')}${cyan(groPackageJson.version as string)}`);
		return;
	}

	const totalTiming = createStopwatch();
	const timings = new Timings();

	// Resolve the input path for the provided task name.
	const inputPath = resolveRawInputPath(taskName || paths.lib);
	console.log(`inputPath`, inputPath);

	// Find the task or directory specified by the `inputPath`.
	// Fall back to searching the Gro directory as well.
	const findModulesResult = await findTaskModules(fs, [inputPath], undefined, [groPaths.root]);
	console.log(`findModulesResult`, findModulesResult);
	if (findModulesResult.ok) {
		// Found a match either in the current working directory or Gro's directory.
		timings.merge(findModulesResult.timings);
		const pathData = findModulesResult.sourceIdPathDataByInputPath.get(inputPath)!; // this is null safe because result is ok
		console.log(`pathData`, pathData);

		// First build the project if needed.
		// This will be removed in favor of using an esm loader with esbuild.
		if (!built) {
			built = true;
			log.debug('building project to run task');
			const timingToLoadConfig = timings.start('load config');
			const config = await loadConfig(fs, true);
			timingToLoadConfig();
			const timingToBuildProject = timings.start('build project');
			await buildSource(fs, config, true, log);
			timingToBuildProject();
		}

		if (!pathData.isDirectory) {
			// The input path matches a file, so load and run it.

			// Try to load the task module.
			// TODO BLOCK why not loadTaskModules ? get good error messages too
			console.log('LOADING', Array.from(findModulesResult.sourceIdsByInputPath.entries()));
			const loadModulesResult = await loadModules(
				findModulesResult.sourceIdsByInputPath,
				true,
				loadTaskModule,
			);
			if (loadModulesResult.ok) {
				// We found a task module. Run it!
				timings.merge(loadModulesResult.timings);
				// `pathData` is not a directory, so there's a single task module here.
				const task = loadModulesResult.modules[0];
				log.info(
					`→ ${cyan(task.name)} ${(task.mod.task.summary && gray(task.mod.task.summary)) || ''}`,
				);
				const timingToRunTask = timings.start('run task');
				console.log(`toForwardedArgs`, toForwardedArgs(`gro ${task.name}`));
				const result = await runTask(
					fs,
					task,
					{...args, ...toForwardedArgs(`gro ${task.name}`)},
					events,
					invokeTask,
				);
				timingToRunTask();
				if (result.ok) {
					log.info(`✓ ${cyan(task.name)}`);
				} else {
					log.info(`${red('🞩')} ${cyan(task.name)}`);
					logErrorReasons(log, [result.reason]);
					throw result.error;
				}
			} else {
				logErrorReasons(log, loadModulesResult.reasons);
				process.exit(1);
			}
		} else {
			// The input path matches a directory. Log the tasks but don't run them.
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
					fs.findFiles(id, (path) => isTaskPath(path)),
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
				fs.findFiles(id, (path) => isTaskPath(path)),
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
