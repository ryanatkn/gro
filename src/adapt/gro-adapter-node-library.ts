import {Timings} from '@feltcoop/felt/utils/time.js';
import {printTimings} from '@feltcoop/felt/utils/print.js';
import {printSpawnResult, spawnProcess} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';
import {UnreachableError} from '@feltcoop/felt/utils/error.js';
import {stripTrailingSlash} from '@feltcoop/felt/utils/path.js';

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

const OTHER_PUBLISHED_FILES = new Set(
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

export interface Options {
	buildOptionsPartial: AdaptBuildOptionsPartial; // defaults to [{buildName: 'lib', type: 'bundled'}]
	distDir: string; // defaults to `dist/${buildName}`
	link: string | null; // path to `npm link`, defaults to null
}

// TODO do we want the esm/cjs flags?
export type AdaptBuildOptions =
	| {buildName: BuildName; type: 'unbundled'; dir: string} // unbundled supports esm only (TODO maybe support cjs?)
	| {buildName: BuildName; type: 'bundled'; dir: string; esm: boolean; cjs: boolean};
export type AdaptBuildOptionsPartial =
	| {buildName: BuildName; type: 'unbundled'} // unbundled supports esm only (TODO maybe support cjs?)
	| {buildName: BuildName; type: 'bundled'; esm?: boolean; cjs?: boolean};

const DEFAULT_BUILD_OPTIONS: AdaptBuildOptionsPartial = {
	buildName: NODE_LIBRARY_BUILD_NAME,
	type: 'unbundled',
};
const toAdaptBuildsOptions = (
	partial: AdaptBuildOptionsPartial,
	distDir: string,
): AdaptBuildOptions => {
	const dir = `${distDir}/${partial.buildName}`;
	if (partial.type === 'unbundled') {
		return {buildName: partial.buildName, type: 'unbundled', dir};
	} else if (partial.type === 'bundled') {
		return {
			buildName: partial.buildName,
			type: 'bundled',
			dir,
			esm: partial.esm ?? true,
			cjs: partial.cjs ?? true,
		};
	} else {
		throw new UnreachableError(partial);
	}
};

interface AdapterArgs {
	mapInputOptions: MapInputOptions;
	mapOutputOptions: MapOutputOptions;
	mapWatchOptions: MapWatchOptions;
}

export const createAdapter = ({
	buildOptionsPartial = DEFAULT_BUILD_OPTIONS,
	distDir = paths.dist,
	link = null,
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	distDir = stripTrailingSlash(distDir);
	const buildOptions = toAdaptBuildsOptions(buildOptionsPartial, distDir);
	return {
		name: '@feltcoop/gro-adapter-node-library',
		begin: async ({fs}) => {
			await fs.remove(distDir);
		},
		adapt: async ({config, fs, dev, log, args}) => {
			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			const timings = new Timings(); // TODO probably move to task context

			const buildConfig = config.builds.find((b) => b.name === buildOptions.buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildOptions.buildName}`);
			}

			const timingToBundleWithRollup = timings.start('bundle with rollup');
			if (buildOptions.type === 'bundled') {
				if (buildOptions.type !== 'bundled') throw Error();
				const {files /* , filters */} = await resolveInputFiles(fs, buildConfig);
				// TODO use `filters` to select the others..right?
				if (!files.length) {
					log.trace('no input files in', printBuildConfigLabel(buildConfig));
					return;
				}
				const input = files.map((sourceId) => toImportId(sourceId, dev, buildConfig.name));
				const outputDir = buildOptions.dir;
				log.info('bundling', printBuildConfigLabel(buildConfig), outputDir, files);
				if (!buildOptions.cjs && !buildOptions.esm) {
					throw Error(`Build must have either cjs or esm or both: ${buildOptions.buildName}`);
				}
				if (buildOptions.cjs) {
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
					await fs.move(`${buildOptions.dir}/index.js`, `${buildOptions.dir}/index.cjs`);
				}
				if (buildOptions.esm) {
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
			const filter = buildOptions.type === 'bundled' ? bundledDistFilter : undefined;
			await copyDist(fs, buildConfig, dev, buildOptions.dir, log, filter);
			timingToCopyDist();

			// copy other published files from the project root to the dist, but don't overwrite
			await Promise.all(
				(await fs.readDir('.')).map((path): void | Promise<void> => {
					const filename = path.toLowerCase();
					if (OTHER_PUBLISHED_FILES.has(filename)) {
						return fs.copy(path, buildOptions.dir, {overwrite: false});
					}
				}),
			);

			// copy src
			fs.copy(paths.source, buildOptions.dir);

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
