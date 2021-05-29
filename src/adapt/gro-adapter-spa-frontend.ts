import {stripTrailingSlash, toCommonBaseDir} from '@feltcoop/felt/utils/path.js';
import {ensureEnd} from '@feltcoop/felt/utils/string.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/utils/object.js';
import {printTimings} from '@feltcoop/felt/utils/print.js';

import type {Adapter} from './adapter.js';
import {runRollup} from '../build/rollup.js';
import {DIST_DIRNAME, sourceIdToBasePath, toBuildExtension, toImportId} from '../paths.js';
import {resolveInputFiles} from '../build/utils.js';
import {printBuildConfigLabel} from '../build/buildConfig.js';
import type {BuildName} from '../build/buildConfig.js';
import {copyDist} from '../build/dist.js';
import {BROWSER_BUILD_NAME} from '../build/defaultBuildConfig.js';

// WIP do not use

const NOJEKYLL = '.nojekyll';
const DEFAULT_TARGET = 'github_pages';

export interface Options {
	builds: readonly BuildName[];
	dir: string;
	target: 'github_pages' | 'static';
}

const DEFAULT_BUILD_NAMES: readonly BuildName[] = [BROWSER_BUILD_NAME];

export const createAdapter = ({
	builds = DEFAULT_BUILD_NAMES,
	dir = DIST_DIRNAME,
	target = DEFAULT_TARGET,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/gro-adapter-spa-frontend',
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
			const timingToBundle = timings.start('bundle');
			await Promise.all(
				buildConfigsToBuild.map(async (buildConfig) => {
					const {files} = await resolveInputFiles(fs, buildConfig);
					if (!files.length) {
						log.trace('no input files in', printBuildConfigLabel(buildConfig));
						return;
					}
					const input = files.map((sourceId) => toImportId(sourceId, dev, buildConfig.name));
					// TODO `files` needs to be mapped to production output files
					const outputDir = `${DIST_DIRNAME}/${toBuildExtension(
						sourceIdToBasePath(ensureEnd(toCommonBaseDir(files), '/')), // TODO refactor when fixing the trailing `/`
					)}`;
					log.info('building', printBuildConfigLabel(buildConfig), outputDir, files);
					await runRollup({
						dev,
						sourcemap: config.sourcemap,
						input,
						outputDir,
						mapInputOptions,
						mapOutputOptions,
						mapWatchOptions,
					});

					// copy static prod files into `dist/`
					await copyDist(fs, buildConfig, dev, `${dir}/${buildConfig.name}`, log);
				}),
			);
			timingToBundle();

			// GitHub pages processes everything with Jekyll by default,
			// breaking things like files and dirs prefixed with an underscore.
			// This adds a `.nojekyll` file to the root of the output
			// to tell GitHub Pages to treat the outputs as plain static files.
			if (target === 'github_pages') {
				const nojekyllPath = `${dir}/${NOJEKYLL}`;
				if (!(await fs.exists(nojekyllPath))) {
					await fs.writeFile(nojekyllPath, '', 'utf8');
				}
			}

			printTimings(timings, log);
		},
	};
};
