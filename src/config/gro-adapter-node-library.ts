import type {Adapter} from './adapt.js';
import {Timings} from '../utils/time.js';
import {printTimings} from '../utils/print.js';
import {printSpawnResult, spawnProcess} from '../utils/process.js';
import {TaskError} from '../task/task.js';
import {copyDist} from '../build/dist.js';
import {DIST_DIRNAME, paths, toBuildOutPath, toDistOutDir} from '../paths.js';
import {PRIMARY_NODE_BUILD_NAME} from './defaultBuildConfig.js';
import {BuildConfig, BuildName, printBuildConfigLabel} from './buildConfig.js';
import {EMPTY_OBJECT} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {stripEnd} from '../utils/string.js';
import {resolveInputFiles} from '../build/utils.js';
import {runRollup} from '../build/rollup.js';
import type {MapInputOptions, MapOutputOptions, MapWatchOptions} from '../build/rollup.js';

export interface Options {
	builds: AdaptBuildOptionsPartial[]; // defaults to [{name: 'node', type: 'bundled'}]
	dir: string; // defaults to dist/
	link: string | null; // path to `npm link`
}

// TODO do we want the esm/cjs flags?
export type AdaptBuildOptions =
	| {name: BuildName; type: 'unbundled'; dir: string} // unbundled supports esm only (TODO maybe support cjs?)
	| {name: BuildName; type: 'bundled'; dir: string; esm: boolean; cjs: boolean};
export type AdaptBuildOptionsPartial =
	| {name: BuildName; type: 'unbundled'} // unbundled supports esm only (TODO maybe support cjs?)
	| {name: BuildName; type: 'bundled'; esm?: boolean; cjs?: boolean};

const DEFAULT_BUILDS: AdaptBuildOptionsPartial[] = [
	{name: PRIMARY_NODE_BUILD_NAME, type: 'bundled'},
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
	dir = stripEnd(dir, '/');
	const count = builds.length;
	const buildOptionsByBuildName: Map<BuildName, AdaptBuildOptions> = new Map(
		builds.map((partial) => [partial.name, toAdaptBuildsOptions(partial, count, dir)]),
	);
	return {
		name: 'gro-adapter-node-library',
		begin: async ({fs}) => {
			await fs.remove(dir);

			// TODO should we compile types here, so they're available to other adapters?
			// it's a little out of the architecture to have `adapt` write to the prod dirs, I think,
			// but a previous step would make more sense
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

			// TODO this leads to false paths with `type: 'bundled'` builds, right?
			// compile again with `tsc` to create all of the TypeScript type defs, sourcemaps, and typemaps
			const timingToCompileWithTsc = timings.start('compile with tsc');
			log.info('compiling with tsc'); // TODO change this api to have `timings` take a logger and replace this line with logging in `start` above
			await Promise.all(
				buildConfigs.map(async (buildConfig) => {
					const {dir} = buildOptionsByBuildName.get(buildConfig.name)!;
					const tscResult = await spawnProcess('npx', [
						'tsc',
						'--outDir',
						dir,
						'--rootDir',
						paths.source,
						'--sourceMap',
						config.sourcemap ? 'true' : 'false',
						'--declarationMap',
						config.sourcemap && dev ? 'true' : 'false',
						'--emitDeclarationOnly',
					]);
					if (!tscResult.ok) {
						throw Error(`TypeScript failed to compile with code ${tscResult.code}`);
					}
					// TODO this is hacky - deletes unused *.d.ts files (like tests) and empty dirs
					const files = await fs.findFiles(dir);
					await Promise.all(
						Array.from(files.entries()).map(async ([path, stats]) => {
							if (stats.isDirectory()) {
								if (!(await fs.exists(toBuildOutPath(dev, buildConfig.name, path)))) {
									await fs.remove(`${dir}/${path}`);
								}
							} else {
								if (path.endsWith('.d.ts')) {
									const jsBuildFilePath = `${stripEnd(path, '.d.ts')}.js`;
									const buildOutPath = toBuildOutPath(dev, buildConfig.name, jsBuildFilePath);
									if (!(await fs.exists(buildOutPath))) {
										await fs.remove(`${dir}/${path}`);
									}
								}
							}
						}),
					);
				}),
			);
			timingToCompileWithTsc();

			const timingToBundleWithRollup = timings.start('bundle with rollup');
			for (const buildConfig of bundled) {
				const buildOptions = buildOptionsByBuildName.get(buildConfig.name)!;
				const {files} = await resolveInputFiles(fs, buildConfig);
				// TODO use `filters` to select the others?
				if (!files.length) {
					log.trace('no input files in', printBuildConfigLabel(buildConfig));
					return;
				}
				const outputDir = buildOptions.dir;
				log.info('bundling', printBuildConfigLabel(buildConfig), outputDir, files);
				await runRollup({
					dev,
					sourcemap: config.sourcemap,
					input: files,
					outputDir,
					mapInputOptions,
					mapOutputOptions,
					mapWatchOptions,
				});
				// TODO rename all files to .mjs automatically
				await fs.move(`${buildOptions.dir}/index.js`, `${buildOptions.dir}/index.mjs`);
				await runRollup({
					dev,
					sourcemap: config.sourcemap,
					input: files,
					outputDir,
					mapInputOptions,
					mapOutputOptions: (outputOptions, options) => {
						const mapped = mapOutputOptions
							? mapOutputOptions(outputOptions, options)
							: outputOptions;
						return {...mapped, format: 'commonjs'};
					},
					mapWatchOptions,
				});
			}
			timingToBundleWithRollup();

			const timingToCopyDist = timings.start('copy unbundled builds to dist');
			for (const buildConfig of unbundled) {
				const buildOptions = buildOptionsByBuildName.get(buildConfig.name)!;
				await copyDist(fs, buildConfig, dev, buildOptions.dir, log);
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
