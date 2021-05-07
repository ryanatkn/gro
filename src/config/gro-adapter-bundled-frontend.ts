import type {Adapter} from './adapt.js';
import {createBuild} from '../build/build.js';
import {DIST_DIR, sourceIdToBasePath, toBuildExtension} from '../paths.js';
import {resolveInputFiles} from '../build/utils.js';
import {toCommonBaseDir} from '../utils/path.js';
import {printBuildConfigLabel} from './buildConfig.js';
import {ensureEnd} from '../utils/string.js';
import {copyDist} from '../build/dist.js';
import {Timings} from '../utils/time.js';

// TODO name? is it actually specific to frontends?

export const createBundledFrontendAdapter = (): Adapter => {
	return {
		name: 'gro-adapter-bundled-frontend',
		adapt: async ({config, fs, args, log, dev}) => {
			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			const timings = new Timings();

			// Not every build config is built for the final `dist/`!
			// Only those that currently have `dist: true` are output.
			// This allows a project's `src/gro.config.ts`
			// to control the "last mile" each time `gro build` is run.
			// TODO maybe assign these to the `config` above?
			const buildConfigsToBuild = config.builds.filter((buildConfig) => buildConfig.dist);
			// For each build config that has `dist: true`,
			// infer which of the inputs are actual source files,
			// and therefore belong in the default Rollup build.
			// If more customization is needed, users should implement their own `src/build.task.ts`,
			// which can be bootstrapped by copy/pasting this one. (and updating the imports)
			const timingToBuild = timings.start('build');
			// TODO this should only happen when we opt into bundling - how is that defined?
			const distCount = config.builds.filter((b) => b.dist).length;
			await Promise.all(
				buildConfigsToBuild.map(async (buildConfig) => {
					const {files, filters} = await resolveInputFiles(fs, buildConfig);
					if (!files.length) {
						log.trace('no input files in', printBuildConfigLabel(buildConfig));
						return;
					}
					// TODO `files` needs to be mapped to production output files
					const outputDir = `${DIST_DIR}${toBuildExtension(
						sourceIdToBasePath(ensureEnd(toCommonBaseDir(files), '/')), // TODO refactor when fixing the trailing `/`
					)}`;
					log.info('building', printBuildConfigLabel(buildConfig), outputDir, files);
					const build = createBuild({
						dev,
						sourcemap: config.sourcemap,
						inputFiles: files,
						outputDir,
						mapInputOptions,
						mapOutputOptions,
						mapWatchOptions,
					});
					await build.promise;

					// TODO might need to be refactored, like `filters` should be `buildConfig.input`
					// copy static prod files into `dist/`
					await copyDist(fs, buildConfig, dev, distCount, log, filters);
				}),
			);
			timingToBuild();
		},
	};
};
