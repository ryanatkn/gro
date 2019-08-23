import {Plugin, ExistingRawSourceMap} from 'rollup';
import {outputFile} from 'fs-extra';
import {blue} from 'kleur';
import {dirname, join, relative} from 'path';
import {decode, encode, SourceMapSegment} from 'sourcemap-codec';

import {LogLevel, logger, Logger} from '../utils/logger';
import {CssBuild, CssBundle} from './cssCache';

interface CssBuildWithSourceMap extends CssBuild {
	map: ExistingRawSourceMap | undefined;
}

export interface Options {
	getCssBundles(): Map<string, CssBundle<CssBuildWithSourceMap>>;
	toFinalCss(build: CssBuild, log: Logger): string;
	sourcemap: boolean; // TODO consider per-bundle options
	logLevel: LogLevel;
}
export type RequiredOptions = 'getCssBundles';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	toFinalCss,
	sourcemap: false,
	logLevel: LogLevel.Info,
	...opts,
});

export const name = 'output-css';

export const outputCssPlugin = (opts: InitialOptions): Plugin => {
	const {sourcemap, getCssBundles, logLevel, toFinalCss} = initOptions(opts);

	const log = logger(logLevel, [blue(`[${name}]`)]);
	const {info} = log;

	return {
		name,
		async generateBundle(outputOptions, _bundle, isWrite) {
			if (!isWrite) return;

			info('generateBundle');

			// TODO chunks!
			const outputDir = outputOptions.dir || dirname(outputOptions.file!);

			// write each changed bundle to disk
			for (const bundle of getCssBundles().values()) {
				const {bundleName, buildsById, changedIds} = bundle;
				if (!changedIds.size) continue;

				info('generating css bundle', blue(bundleName));
				info('changes', Array.from(changedIds)); // TODO trace when !watch
				changedIds.clear();

				const mappings: SourceMapSegment[][] = [];
				const sources: string[] = [];
				const sourcesContent: string[] = [];

				let cssStrings: string[] = [];
				for (const build of buildsById.values()) {
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

				const dest = join(outputDir, bundleName);

				if (sources.length) {
					const sourcemapDest = dest + '.map';
					const finalCss =
						css + `\n/*# sourceMappingURL=${bundleName}.map */\n`;
					const cssSourcemap = JSON.stringify(
						{
							version: 3,
							file: bundleName,
							sources: sources.map(s => relative(outputDir, s)),
							sourcesContent,
							names: [],
							mappings: encode(mappings),
						},
						null,
						2,
					);

					info('writing css bundle and sourcemap', dest);
					await Promise.all([
						outputFile(dest, finalCss),
						outputFile(sourcemapDest, cssSourcemap),
					]);
				} else {
					info('writing css bundle', dest);
					await outputFile(dest, css);
				}
			}
		},
	};
};

const toFinalCss = ({code}: CssBuild, _log: Logger): string => code;
