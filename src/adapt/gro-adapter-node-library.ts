import {Timings} from '@feltcoop/felt/utils/time.js';
import {printTimings} from '@feltcoop/felt/utils/print.js';
import {printSpawnResult, spawnProcess} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';

import type {Adapter} from './adapter.js';
import {TaskError} from '../task/task.js';
import {copyDist} from '../build/dist.js';
import {paths, toImportId, TS_TYPEMAP_EXTENSION, TS_TYPE_EXTENSION} from '../paths.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/defaultBuildConfig.js';
import {BuildName, printBuildConfigLabel} from '../build/buildConfig.js';
import {resolveInputFiles} from '../build/utils.js';
import {runRollup} from '../build/rollup.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from '../build/rollup.js';
import type {PathStats} from '../fs/pathData.js';

export interface Options {
	buildName: BuildName; // defaults to 'library'
	type: 'unbundled' | 'bundled'; // defaults to 'unbundled'
	dir: string; // defaults to `dist/${buildName}`
	link: string | null; // path to `npm link`, defaults to null
	// TODO currently these options are only available for 'bundled'
	esm: boolean; // defaults to true
	cjs: boolean; // defaults to true
	pack: boolean; // treat the dist as a package to be published - defaults to true
}

interface AdapterArgs {
	mapInputOptions: MapInputOptions;
	mapOutputOptions: MapOutputOptions;
	mapWatchOptions: MapWatchOptions;
}

export const createAdapter = ({
	buildName = NODE_LIBRARY_BUILD_NAME,
	type = 'unbundled',
	dir = `${paths.dist}${buildName}`,
	link = null,
	esm = true,
	cjs = true,
	pack = true,
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	return {
		name: '@feltcoop/gro-adapter-node-library',
		begin: async ({fs}) => {
			await fs.remove(dir);
		},
		adapt: async ({config, fs, dev, log, args}) => {
			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			const timings = new Timings(); // TODO probably move to task context

			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			const timingToBundleWithRollup = timings.start('bundle with rollup');
			if (type === 'bundled') {
				if (type !== 'bundled') throw Error();
				const {files /* , filters */} = await resolveInputFiles(fs, buildConfig);
				// TODO use `filters` to select the others..right?
				if (!files.length) {
					log.trace('no input files in', printBuildConfigLabel(buildConfig));
					return;
				}
				const input = files.map((sourceId) => toImportId(sourceId, dev, buildConfig.name));
				const outputDir = dir;
				log.info('bundling', printBuildConfigLabel(buildConfig), outputDir, files);
				if (!cjs && !esm) {
					throw Error(`Build must have either cjs or esm or both: ${buildName}`);
				}
				if (cjs) {
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input,
						outputDir,
						mapInputOptions,
						mapOutputOptions: (o, b) => ({
							...(mapOutputOptions ? mapOutputOptions(o, b) : o),
							format: 'commonjs',
						}),
						mapWatchOptions,
					});
					await fs.move(`${dir}/index.js`, `${dir}/index.cjs`);
				}
				if (esm) {
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input,
						outputDir,
						mapInputOptions,
						mapOutputOptions,
						mapWatchOptions,
					});
				}
			}
			timingToBundleWithRollup();

			const timingToCopyDist = timings.start('copy builds to dist');
			const filter = type === 'bundled' ? bundledDistFilter : undefined;
			await copyDist(fs, buildConfig, dev, dir, log, filter);
			timingToCopyDist();

			// if the output is treated as a package,
			// copy files from the project root to the dist, but don't overwrite anything in the build
			if (pack) {
				await Promise.all(
					(await fs.readDir('.')).map((path): void | Promise<void> => {
						const filename = path.toLowerCase();
						if (PACKAGE_FILES.has(filename)) {
							return fs.copy(path, `${dir}/${path}`, {overwrite: false});
						}
					}),
				);
			}

			// copy src
			fs.copy(paths.source, dir);

			// `npm link` if configured
			if (link) {
				const timingToNpmLink = timings.start('npm link');
				const chmodResult = await spawnProcess('chmod', ['+x', link]);
				if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
				log.info(`linking`);
				const linkResult = await spawnProcess('npm', ['link']);
				if (!linkResult.ok) {
					throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
				}
				timingToNpmLink();
			}

			printTimings(timings, log);
		},
	};
};

const bundledDistFilter = (id: string, stats: PathStats): boolean =>
	stats.isDirectory() ? true : id.endsWith(TS_TYPE_EXTENSION) || id.endsWith(TS_TYPEMAP_EXTENSION);

const PACKAGE_FILES = new Set(
	['package.json'].concat(
		// these can be any case and optionally end with `.md`
		[
			'README',
			'CHANGES',
			'CHANGELOG',
			'HISTORY',
			'LICENSE',
			'LICENCE',
			'NOTICE',
			'GOVERNANCE',
		].flatMap((filename) => {
			const lower = filename.toLowerCase();
			return [lower, `${lower}.md`];
		}),
	),
);
