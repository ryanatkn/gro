import {cyan, red, gray} from 'kleur/colors';
import {EventEmitter} from 'node:events';
import {SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {printMs, printTimings} from '@feltjs/util/print.js';
import {spawn} from '@feltjs/util/process.js';

import {serializeArgs, toForwardedArgs, toRawRestArgs, type Args} from '../util/args.js';
import {runTask} from './runTask.js';
import {resolveRawInputPath} from '../fs/inputPath.js';
import {isTaskPath} from './task.js';
import {
	paths,
	groPaths,
	replaceRootDir,
	isGroId,
	isThisProjectGro,
	printPath,
	printPathOrGroPath,
} from '../paths.js';
import {findModules, loadModules} from '../fs/modules.js';
import {findTaskModules, loadTaskModule} from './taskModule.js';
import {loadGroPackageJson} from '../util/packageJson.js';
import type {Filesystem} from '../fs/filesystem.js';
import {logAvailableTasks, logErrorReasons} from './logTask.js';

/**
 * Invokes Gro tasks by name using the filesystem as the source.
 *
 * When a task is invoked,
 * Gro first searches for tasks in the current working directory.
 * and falls back to searching Gro's directory, if the two are different.
 * See `src/lib/fs/inputPath.ts` for info about what "taskName" can refer to.
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

	// Check if the caller just wants to see the version.
	if (!taskName && args.version) {
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
	const findModulesResult = await findTaskModules(fs, [inputPath], undefined, [groPaths.root]);

	if (findModulesResult.ok) {
		timings.merge(findModulesResult.timings);
		// Found a match either in the current working directory or Gro's directory.
		const pathData = findModulesResult.sourceIdPathDataByInputPath.get(inputPath)!; // this is null safe because result is ok
		if (!pathData.isDirectory) {
			// The input path matches a file, so load and run it.

			// First build the project. Gro used to try to detect if it should build,
			// but since the advent of Very fast TypeScript transpilers
			// (we're using esbuild because of SvelteKit)
			// it's a better UX to always build first,
			// because it usually takes less than a few hundred milliseconds.
			// Over time we'll remove much of Gro's functionality and use something like `tsm`:
			// https://github.com/feltjs/gro/issues/319

			// Import these lazily to avoid importing their comparatively heavy transitive dependencies
			// every time a task is invoked.
			log.debug('building project to run task');
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
					const result = await spawn(
						'npx',
						['gro', taskName, ...serializeArgs(args), ...toRawRestArgs()],
						{env: {...process.env, NODE_ENV: 'production'}},
					);
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
					const finalArgs = {...args, ...toForwardedArgs(`gro ${task.name}`)};
					const result = await runTask(fs, task, finalArgs, events, invokeTask);
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
