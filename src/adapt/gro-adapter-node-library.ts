import {Timings} from '@feltcoop/felt/utils/time.js';
import {printTimings} from '@feltcoop/felt/utils/print.js';
import {printSpawnResult, spawnProcess} from '@feltcoop/felt/utils/process.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';
import {stripTrailingSlash} from '@feltcoop/felt/utils/path.js';

import type {Adapter} from './adapter.js';
import {TaskError} from '../task/task.js';
import {copyDist} from '../build/dist.js';
import {
	paths,
	SOURCE_DIRNAME,
	toImportId,
	TS_TYPEMAP_EXTENSION,
	TS_TYPE_EXTENSION,
} from '../paths.js';
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
	dir = stripTrailingSlash(dir);
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

			// If the output is treated as a package, it needs some special handling to get it ready.
			if (pack) {
				// copy files from the project root to the dist, but don't overwrite anything in the build
				await Promise.all(
					(await fs.readDir('.')).map((path): void | Promise<void> => {
						const filename = path.toLowerCase();
						if (PACKAGE_FILES.has(filename) || OTHER_PACKAGE_FILES.has(filename)) {
							return fs.copy(path, `${dir}/${path}`, {overwrite: false});
						}
					}),
				);

				// copy src
				await fs.copy(paths.source, `${dir}/${SOURCE_DIRNAME}`);

				// TODO
				// update the `package.json` with "files" and "exports"
				// "exports": {
				//   ".": "./index.js",
				//   "./package.json": "./package.json",
				//   "./utils/array.js": "./utils/array.js",
				//   "./utils/async.js": "./utils/async.js",
				//   "./utils/env.js": "./utils/env.js",
				//   "./utils/equal.js": "./utils/equal.js",
				//   "./utils/error.js": "./utils/error.js",
				//   "./utils/function.js": "./utils/function.js",
				//   "./utils/json.js": "./utils/json.js",
				//   "./utils/lock.js": "./utils/lock.js",
				//   "./utils/log.js": "./utils/log.js",
				//   "./utils/map.js": "./utils/map.js",
				//   "./utils/math.js": "./utils/math.js",
				//   "./utils/object.js": "./utils/object.js",
				//   "./utils/obtainable.js": "./utils/obtainable.js",
				//   "./utils/path.js": "./utils/path.js",
				//   "./utils/print.js": "./utils/print.js",
				//   "./utils/process.js": "./utils/process.js",
				//   "./utils/random.js": "./utils/random.js",
				//   "./utils/string.js": "./utils/string.js",
				//   "./utils/terminal.js": "./utils/terminal.js",
				//   "./utils/time.js": "./utils/time.js",
				//   "./utils/uuid.js": "./utils/uuid.js"
				// },
				const pkgPath = `${dir}/package.json`;
				const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

				const files = new Set(pkg.files || []);
				const dirPaths = await fs.readDir(dir);
				for (const path of dirPaths) {
					if (
						!PACKAGE_FILES.has(path.toLowerCase()) &&
						!path.endsWith(TS_TYPE_EXTENSION) &&
						!path.endsWith(TS_TYPEMAP_EXTENSION)
					) {
						files.add(path);
					}
				}
				pkg.files = Array.from(files);
				await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
				// "files": [
				//   "index.js",
				//   "src",
				//   "lib",
				//   "utils"
				// ],
			}

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

// these can be any case and optionally end with `.md`
const toPossibleFileNames = (paths: string[]): string[] =>
	paths.flatMap((path) => {
		const lower = path.toLowerCase();
		return [lower, `${lower}.md`];
	});

// these are the files npm includes by default; unlike npm, the only extension we support is `.md`
const PACKAGE_FILES = new Set(
	['package.json'].concat(
		toPossibleFileNames([
			'README',
			'CHANGES',
			'CHANGELOG',
			'HISTORY',
			'LICENSE',
			'LICENCE',
			'NOTICE',
		]),
	),
);
const OTHER_PACKAGE_FILES = new Set(toPossibleFileNames(['GOVERNANCE']));
