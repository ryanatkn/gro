import {Plugin} from 'rollup';
import fs from 'fs-extra';
import * as fp from 'path';
import sourcemapCodec from 'sourcemap-codec';
const {decode, encode} = sourcemapCodec; // TODO esm

import {blue, gray} from '../colors/terminal.js';
import {LogLevel, logger, Logger} from '../utils/logUtils.js';
import {GroCssBuild, GroCssBundle} from './types.js';
import {omitUndefined} from '../utils/objectUtils.js';

export interface Options {
	getCssBundles(): Map<string, GroCssBundle>;
	toFinalCss(build: GroCssBuild, log: Logger): string;
	sourcemap: boolean; // TODO consider per-bundle options
	logLevel: LogLevel;
}
export type RequiredOptions = 'getCssBundles';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	toFinalCss,
	sourcemap: false,
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const name = 'output-css';

export const outputCssPlugin = (opts: InitialOptions): Plugin => {
	const {getCssBundles, toFinalCss, sourcemap, logLevel} = initOptions(opts);

	const log = logger(logLevel, [blue(`[${name}]`)]);
	const {info, trace} = log;

	return {
		name,
		async generateBundle(outputOptions, _bundle, isWrite) {
			if (!isWrite) return;

			info('generateBundle');

			// TODO chunks!
			const outputDir = outputOptions.dir || fp.dirname(outputOptions.file!);

			// write each changed bundle to disk
			for (const bundle of getCssBundles().values()) {
				const {bundleName, buildsById, changedIds} = bundle;
				if (!changedIds.size) {
					trace(`no changes detected, skipping bundle ${gray(bundleName)}`);
					continue;
				}

				// TODO try to avoid doing work for the sourcemap and `toFinalCss` by caching stuff that hasn't changed
				info('generating css bundle', blue(bundleName));
				info('changes', Array.from(changedIds)); // TODO trace when !watch
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
						const decoded = decode(build.map.mappings);
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

				const dest = fp.join(outputDir, bundleName);

				if (sources.length) {
					const sourcemapDest = dest + '.map';
					const finalCss =
						css + `\n/*# sourceMappingURL=${bundleName}.map */\n`;
					const cssSourcemap = JSON.stringify(
						{
							version: 3,
							file: bundleName,
							sources: sources.map(s => fp.relative(outputDir, s)),
							sourcesContent,
							names: [],
							mappings: encode(mappings),
						},
						null,
						2,
					);

					info('writing css bundle and sourcemap', dest);
					await Promise.all([
						fs.outputFile(dest, finalCss),
						fs.outputFile(sourcemapDest, cssSourcemap),
					]);
				} else {
					info('writing css bundle', dest);
					await fs.outputFile(dest, css);
				}
			}
		},
	};
};

const toFinalCss = ({code}: GroCssBuild, _log: Logger): string => code;
