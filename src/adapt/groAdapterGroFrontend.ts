import {stripTrailingSlash, toCommonBaseDir} from '@feltcoop/felt/util/path.js';
import {ensureEnd} from '@feltcoop/felt/util/string.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import type {Plugin as RollupPlugin} from 'rollup';
import {extname} from 'path';

import type {Adapter} from 'src/adapt/adapt.js';
import type {MapInputOptions} from 'src/build/rollup.js';
import {runRollup} from '../build/rollup.js';
import {DIST_DIRNAME, sourceIdToBasePath, toImportId} from '../paths.js';
import {printBuildConfigLabel, toInputFiles} from '../build/buildConfig.js';
import type {BuildName} from 'src/build/buildConfig.js';
import type {HostTarget} from 'src/adapt/utils.js';
import {copyDist, ensureNojekyll} from './utils.js';
import {BROWSER_BUILD_NAME, defaultNonAssetExtensions} from '../build/buildConfigDefaults.js';
import type {IdStatsFilter} from 'src/fs/filter.js';

export interface Options {
	buildName: BuildName;
	dir: string;
	minify: boolean;
	hostTarget: HostTarget;
	filter: IdStatsFilter;
}

export const createAdapter = ({
	buildName = BROWSER_BUILD_NAME,
	dir = `${DIST_DIRNAME}/${buildName}`,
	minify = true,
	hostTarget = 'githubPages',
	filter = defaultFilter,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = stripTrailingSlash(dir);
	return {
		name: '@feltcoop/groAdapterGroFrontend',
		adapt: async ({config, fs, args, log, dev, timings}) => {
			await fs.remove(dir);

			const {mapInputOptions, mapOutputOptions, mapWatchOptions} = args;

			// Infer which of the inputs are actual source files,
			// and therefore belong in the default Rollup build.
			// If more customization is needed, users should implement their own `src/build.task.ts`,
			// which can be bootstrapped by copy/pasting this one. (and updating the imports)
			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Cannot find build config named ${buildName}`);
			}

			const timingToBundle = timings.start('bundle');
			const files = toInputFiles(buildConfig.input);
			if (files.length) {
				const input = files.map((sourceId) => toImportId(sourceId, dev, buildName));
				const outputDir = `${dir}/${sourceIdToBasePath(
					ensureEnd(toCommonBaseDir(files), '/'),
				)}`;
				log.info('building', printBuildConfigLabel(buildConfig), outputDir, files);
				console.log('config.sourcemap', config.sourcemap);
				await runRollup({
					fs,
					dev,
					sourcemap: config.sourcemap,
					input,
					outputDir,
					mapInputOptions:
						mapInputOptions ||
						// refactor lol
						(await (async () => {
							const plugins: RollupPlugin[] = [];
							if (minify) {
								plugins.push(
									(await import('../build/rollupPluginGroTerser.js')).rollupPluginGroTerser({
										minifyOptions: {sourceMap: config.sourcemap},
									}),
								);
							}
							const mapRollupInputOptions: MapInputOptions = (r) => ({
								...r,
								plugins: (r.plugins || []).concat(plugins),
							});
							return mapRollupInputOptions;
						})()),
					mapOutputOptions,
					mapWatchOptions,
				});
			} else {
				log.trace('no input files in', printBuildConfigLabel(buildConfig));
			}
			timingToBundle();

			// TODO this should actually filter based on the build config input, no?
			await copyDist(fs, buildConfig, dev, dir, log, filter);

			if (hostTarget === 'githubPages') {
				await ensureNojekyll(fs, dir);
			}
		},
	};
};

const defaultFilter: IdStatsFilter = (id) => !defaultNonAssetExtensions.has(extname(id));
