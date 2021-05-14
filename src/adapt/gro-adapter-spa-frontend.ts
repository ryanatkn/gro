import type {Adapter} from './adapter.js';
import {runRollup} from '../build/rollup.js';
import {DIST_DIRNAME, sourceIdToBasePath, toBuildExtension, toDistOutDir} from '../paths.js';
import {resolveInputFiles} from '../build/utils.js';
import {toCommonBaseDir} from '../utils/path.js';
import {printBuildConfigLabel} from '../config/buildConfig.js';
import type {BuildName} from '../config/buildConfig.js';
import {ensureEnd} from '../utils/string.js';
import {copyDist} from '../build/dist.js';
import {Timings} from '../utils/time.js';
import {DEFAULT_BROWSER_BUILD_NAME} from '../config/defaultBuildConfig.js';
import {EMPTY_OBJECT} from '../utils/object.js';

// TODO name? is it actually specific to frontends? or is this more about bundling?

export interface Options {
	builds: readonly BuildName[];
	dir: string;
}

const DEFAULT_BUILD_NAMES: readonly BuildName[] = [DEFAULT_BROWSER_BUILD_NAME];

export const createAdapter = ({
	builds = DEFAULT_BUILD_NAMES,
	dir = DIST_DIRNAME,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	return {
		name: 'gro-adapter-spa-frontend',
		begin: async ({fs}) => {
			await fs.remove(dir);
		},
		adapt: async ({config, fs, args, log, dev}) => {
			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			const timings = new Timings();

			// Not every build config is built for the final `dist/`!
			const buildConfigsToBuild = config.builds.filter((b) => builds.includes(b.name));

			// For each build config that has `dist: true`,
			// infer which of the inputs are actual source files,
			// and therefore belong in the default Rollup build.
			// If more customization is needed, users should implement their own `src/build.task.ts`,
			// which can be bootstrapped by copy/pasting this one. (and updating the imports)
			const timingToBuild = timings.start('build');
			await Promise.all(
				buildConfigsToBuild.map(async (buildConfig) => {
					const {files, filters} = await resolveInputFiles(fs, buildConfig);
					if (!files.length) {
						log.trace('no input files in', printBuildConfigLabel(buildConfig));
						return;
					}
					// TODO `files` needs to be mapped to production output files
					const outputDir = `${DIST_DIRNAME}/${toBuildExtension(
						sourceIdToBasePath(ensureEnd(toCommonBaseDir(files), '/')), // TODO refactor when fixing the trailing `/`
					)}`;
					log.info('building', printBuildConfigLabel(buildConfig), outputDir, files);
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input: files,
						outputDir,
						mapInputOptions,
						mapOutputOptions,
						mapWatchOptions,
					});

					// copy static prod files into `dist/`
					await copyDist(
						fs,
						buildConfig,
						dev,
						toDistOutDir(buildConfig.name, buildConfigsToBuild.length, dir),
						log,
						filters,
					);
				}),
			);
			timingToBuild();
		},
	};
};
