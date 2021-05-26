import type {Adapter} from './adapter.js';
import {Timings} from '../utils/time.js';
import {printTimings} from '../utils/print.js';
import {printSpawnResult, spawnProcess} from '../utils/process.js';
import {TaskError} from '../task/task.js';
import {copyDist} from '../build/dist.js';
import {
	DIST_DIRNAME,
	toDistOutDir,
	toImportId,
	TS_TYPEMAP_EXTENSION,
	TS_TYPE_EXTENSION,
} from '../paths.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/defaultBuildConfig.js';
import {BuildConfig, BuildName, printBuildConfigLabel} from '../build/buildConfig.js';
import {EMPTY_OBJECT} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {resolveInputFiles} from '../build/utils.js';
import {runRollup} from '../build/rollup.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from '../build/rollup.js';
import type {PathStats} from '../fs/pathData.js';
import {stripTrailingSlash} from '../utils/path.js';

// TODO this adapter behaves as if it owns the dist/ directory, how to compose?

export interface Options {
	builds: AdaptBuildOptionsPartial[]; // defaults to [{name: 'lib', type: 'bundled'}]
	dir: string; // defaults to dist/
	link: string | null; // path to `npm link`, defaults to null
}

// TODO do we want the esm/cjs flags?
export type AdaptBuildOptions =
	| {name: BuildName; type: 'unbundled'; dir: string} // unbundled supports esm only (TODO maybe support cjs?)
	| {name: BuildName; type: 'bundled'; dir: string; esm: boolean; cjs: boolean};
export type AdaptBuildOptionsPartial =
	| {name: BuildName; type: 'unbundled'} // unbundled supports esm only (TODO maybe support cjs?)
	| {name: BuildName; type: 'bundled'; esm?: boolean; cjs?: boolean};

const DEFAULT_BUILDS: AdaptBuildOptionsPartial[] = [
	{name: NODE_LIBRARY_BUILD_NAME, type: 'bundled'},
];
const toAdaptBuildsOptions = (
	partial: AdaptBuildOptionsPartial,
	count: number,
	distDir: string,
): AdaptBuildOptions => {
	const dir = toDistOutDir(partial.name, count, distDir);
	if (partial.type === 'unbundled') {
		return {name: partial.name, type: 'unbundled', dir};
	} else if (partial.type === 'bundled') {
		return {
			name: partial.name,
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
	builds = DEFAULT_BUILDS,
	dir = DIST_DIRNAME,
	link = null,
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	dir = stripTrailingSlash(dir);
	const count = builds.length;
	if (!count) throw Error('No builds provided');
	const buildOptionsByBuildName: Map<BuildName, AdaptBuildOptions> = new Map(
		builds.map((partial) => [partial.name, toAdaptBuildsOptions(partial, count, dir)]),
	);
	return {
		name: '@feltcoop/gro-adapter-node-library',
		begin: async ({fs}) => {
			await fs.remove(dir);
		},
		adapt: async ({config, fs, dev, log, args}) => {
			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			const timings = new Timings(); // TODO probably move to task context

			const buildConfigs: BuildConfig[] = [];
			const bundled: BuildConfig[] = [];
			const unbundled: BuildConfig[] = [];
			for (const buildOptions of buildOptionsByBuildName.values()) {
				const buildConfig = config.builds.find((b) => b.name === buildOptions.name);
				if (!buildConfig) {
					throw Error(`Unknown build config: ${buildOptions.name}`);
				}
				buildConfigs.push(buildConfig);
				if (buildOptions.type === 'unbundled') {
					unbundled.push(buildConfig);
				} else if (buildOptions.type === 'bundled') {
					bundled.push(buildConfig);
				} else {
					throw new UnreachableError(buildOptions);
				}
			}

			const timingToBundleWithRollup = timings.start('bundle with rollup');
			for (const buildConfig of bundled) {
				const buildOptions = buildOptionsByBuildName.get(buildConfig.name)!;
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
					throw Error(`Build must have either cjs or esm or both: ${buildOptions.name}`);
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
			for (const buildConfig of buildConfigs) {
				const buildOptions = buildOptionsByBuildName.get(buildConfig.name)!;
				const filter = bundled.includes(buildConfig) ? bundledDistFilter : undefined;
				await copyDist(fs, buildConfig, dev, buildOptions.dir, log, filter);
			}
			timingToCopyDist();

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
