import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as SvelteCompileOptions} from 'svelte/types/compiler/interfaces';

import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import {
	baseSvelteCompileOptions,
	createDefaultPreprocessor,
	CreatePreprocessor,
	handleStats,
	handleWarn,
	SvelteCompilation,
} from './svelteBuildHelpers.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildOutPath,
} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import type {Builder, BuildResult, TextBuild, TextBuildSource} from './builder.js';
import type {BuildConfig} from '../config/buildConfig.js';
import {UnreachableError} from '../utils/error.js';
import {cyan} from '../utils/terminal.js';
import {addCssSourcemapFooter, addJsSourcemapFooter} from './utils.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createPreprocessor: CreatePreprocessor;
	// TODO how to support options like this without screwing up caching?
	// maybe compilers need a way to declare their options so they (or a hash) can be cached?
	svelteCompileOptions: SvelteCompileOptions;
	onwarn: typeof handleWarn;
	onstats: typeof handleStats | null;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		onwarn: handleWarn,
		onstats: null,
		createPreprocessor: createDefaultPreprocessor,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger([cyan('[svelteBuilder]')]),
		svelteCompileOptions: opts.svelteCompileOptions || {},
	};
};

type SvelteBuilder = Builder<TextBuildSource, TextBuild>;

export const createSvelteBuilder = (opts: InitialOptions = {}): SvelteBuilder => {
	const {log, createPreprocessor, svelteCompileOptions, onwarn, onstats} = initOptions(opts);

	const preprocessorCache: Map<string, PreprocessorGroup | PreprocessorGroup[] | null> = new Map();
	const getPreprocessor = (
		sourcemap: boolean,
		target: EcmaScriptTarget,
	): PreprocessorGroup | PreprocessorGroup[] | null => {
		const key = sourcemap + target;
		const existingPreprocessor = preprocessorCache.get(key);
		if (existingPreprocessor !== undefined) return existingPreprocessor;
		const newPreprocessor = createPreprocessor(target, sourcemap);
		preprocessorCache.set(key, newPreprocessor);
		return newPreprocessor;
	};

	const build: SvelteBuilder['build'] = async (
		source,
		buildConfig,
		{buildDir, dev, sourcemap, target},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`svelte only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		let preprocessedCode: string;

		// TODO see rollup-plugin-svelte for how to track deps
		// let dependencies = [];
		const preprocessor = getPreprocessor(sourcemap, target);
		if (preprocessor !== null) {
			const preprocessed = await svelte.preprocess(contents, preprocessor, {filename: id});
			preprocessedCode = preprocessed.code;
			// dependencies = preprocessed.dependencies; // TODO
		} else {
			preprocessedCode = contents;
		}

		const output: SvelteCompilation = svelte.compile(preprocessedCode, {
			...baseSvelteCompileOptions,
			dev,
			generate: getGenerateOption(buildConfig),
			...svelteCompileOptions,
			filename: id, // TODO should we be giving a different path?
		});
		const {js, css, warnings, stats} = output;

		for (const warning of warnings) {
			onwarn(id, warning, handleWarn, log);
		}
		if (onstats) onstats(id, stats, handleStats, log);

		const jsFilename = `${source.filename}${JS_EXTENSION}`;
		const cssFilename = `${source.filename}${CSS_EXTENSION}`;
		const jsId = `${outDir}${jsFilename}`;
		const cssId = `${outDir}${cssFilename}`;
		const hasJsSourcemap = sourcemap && js.map !== undefined;
		const hasCssSourcemap = sourcemap && css.map !== undefined;

		const builds: TextBuild[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding,
				contents: hasJsSourcemap
					? addJsSourcemapFooter(js.code, jsFilename + SOURCEMAP_EXTENSION)
					: js.code,
				buildConfig,
			},
		];
		if (hasJsSourcemap) {
			builds.push({
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding,
				contents: JSON.stringify(js.map), // TODO do we want to also store the object version?
				buildConfig,
			});
		}
		if (css.code) {
			builds.push({
				id: cssId,
				filename: cssFilename,
				dir: outDir,
				extension: CSS_EXTENSION,
				encoding,
				contents: hasCssSourcemap
					? addCssSourcemapFooter(css.code, cssFilename + SOURCEMAP_EXTENSION)
					: css.code,
				buildConfig,
			});
			if (hasCssSourcemap) {
				builds.push({
					id: cssId + SOURCEMAP_EXTENSION,
					filename: cssFilename + SOURCEMAP_EXTENSION,
					dir: outDir,
					extension: SOURCEMAP_EXTENSION,
					encoding,
					contents: JSON.stringify(css.map), // TODO do we want to also store the object version?
					buildConfig,
				});
			}
		}
		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	return {build};
};

const getGenerateOption = (buildConfig: BuildConfig): 'dom' | 'ssr' | false => {
	switch (buildConfig.platform) {
		case 'browser':
			return 'dom';
		case 'node':
			return 'ssr';
		default:
			throw new UnreachableError(buildConfig.platform);
	}
};
