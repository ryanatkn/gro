import {Plugin} from 'rollup';
import {dirname, join, relative} from 'path';
import sourcemapCodec from 'sourcemap-codec';
import {blue, gray} from 'kleur/colors';

import {outputFile} from '../fs/nodeFs.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {GroCssBuild, GroCssBundle} from './types.js';
import {omitUndefined} from '../utils/object.js';

export interface Options {
	getCssBundles(): Map<string, GroCssBundle>;
	toFinalCss(build: GroCssBuild, log: Logger): string;
	sourcemap: boolean; // TODO consider per-bundle options
}
export type RequiredOptions = 'getCssBundles';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	toFinalCss,
	sourcemap: false,
	...omitUndefined(opts),
});

export const name = 'output-css';

export const outputCssPlugin = (opts: InitialOptions): Plugin => {
	const {getCssBundles, toFinalCss, sourcemap} = initOptions(opts);

	const log = new SystemLogger([blue(`[${name}]`)]);

	return {
		name,
		async generateBundle(outputOptions, _bundle, isWrite) {
			if (!isWrite) return;

			log.info('generateBundle');

			// TODO chunks!
			const outputDir = outputOptions.dir || dirname(outputOptions.file!);

			// write each changed bundle to disk
			for (const bundle of getCssBundles().values()) {
				const {bundleName, buildsById, changedIds} = bundle;
				if (!changedIds.size) {
					log.trace(`no changes detected, skipping bundle ${gray(bundleName)}`);
					continue;
				}

				// TODO try to avoid doing work for the sourcemap and `toFinalCss` by caching stuff that hasn't changed
				log.info('generating css bundle', blue(bundleName));
				log.info('changes', Array.from(changedIds)); // TODO trace when !watch
				changedIds.clear();

				const mappings: sourcemapCodec.SourceMapSegment[][] = [];
				const sources: string[] = [];
				const sourcesContent: string[] = [];

				// sort the css builds, so the cascade works according to import order
				const builds = Array.from(buildsById.values()).sort((a, b) =>
					a.sortIndex > b.sortIndex ? 1 : -1,
				);

				// create the final css and sourcemap
				let cssStrings: string[] = [];
				for (const build of builds) {
					const code = toFinalCss(build, log);
					if (!code) continue;
					cssStrings.push(code);

					// add css sourcemap to later merge
					// TODO avoid work if there's a single sourcemap
					// TODO do we we ever want a warning/error if `build.map` is undefined?
					if (sourcemap && build.map && build.map.sourcesContent) {
						const sourcesLength = sources.length;
						sources.push(build.map.sources[0]);
						sourcesContent.push(build.map.sourcesContent[0]);
						const decoded = sourcemapCodec.decode(build.map.mappings);
						if (sourcesLength > 0) {
							for (const line of decoded) {
								for (const segment of line) {
									segment[1] = sourcesLength;
								}
							}
						}
						mappings.push(...decoded);
					}
				}
				const css = cssStrings.join('\n');

				const dest = join(outputDir, bundleName);

				if (sources.length) {
					const sourcemapDest = dest + '.map';
					const finalCss = css + `\n/*# sourceMappingURL=${bundleName}.map */\n`;
					const cssSourcemap = JSON.stringify(
						{
							version: 3,
							file: bundleName,
							sources: sources.map((s) => relative(outputDir, s)),
							sourcesContent,
							names: [],
							mappings: sourcemapCodec.encode(mappings),
						},
						null,
						2,
					);

					log.info('writing css bundle and sourcemap', dest);
					await Promise.all([outputFile(dest, finalCss), outputFile(sourcemapDest, cssSourcemap)]);
				} else {
					log.info('writing css bundle', dest);
					await outputFile(dest, css);
				}
			}
		},
	};
};

const toFinalCss = ({code}: GroCssBuild, _log: Logger): string => code;
