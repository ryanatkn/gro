import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as SvelteCompileOptions} from 'svelte/types/compiler/interfaces';
import {print_log_label, System_Logger} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import {cyan} from '@feltcoop/felt/utils/terminal.js';

import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import {
	baseSvelteCompileOptions,
	createDefaultPreprocessor,
	handleStats,
	handleWarn,
} from './svelteBuildHelpers.js';
import type {CreatePreprocessor, SvelteCompilation} from './svelteBuildHelpers.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	SVELTE_EXTENSION,
	to_build_out_path,
} from '../paths.js';
import type {Builder, BuildResult, TextBuild, TextBuildSource} from './builder.js';
import type {Build_Config} from '../build/build_config.js';
import {add_css_sourcemap_footer, add_js_sourcemap_footer} from './utils.js';

// TODO build types in production unless `declarations` is `false`,
// so they'll be automatically copied into unbundled production dists

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
		log: opts.log || new System_Logger(print_log_label('svelteBuilder', cyan)),
		svelteCompileOptions: opts.svelteCompileOptions || {},
	};
};

type SvelteBuilder = Builder<TextBuildSource, TextBuild>;

export const createSvelteBuilder = (opts: InitialOptions = {}): SvelteBuilder => {
	const {log, createPreprocessor, svelteCompileOptions, onwarn, onstats} = initOptions(opts);

	const preprocessorCache: Map<string, PreprocessorGroup | PreprocessorGroup[] | null> = new Map();
	const getPreprocessor = (
		target: EcmaScriptTarget,
		dev: boolean,
		sourcemap: boolean,
	): PreprocessorGroup | PreprocessorGroup[] | null => {
		const key = sourcemap + target;
		const existingPreprocessor = preprocessorCache.get(key);
		if (existingPreprocessor !== undefined) return existingPreprocessor;
		const newPreprocessor = createPreprocessor(target, dev, sourcemap);
		preprocessorCache.set(key, newPreprocessor);
		return newPreprocessor;
	};

	const build: SvelteBuilder['build'] = async (
		source,
		build_config,
		{build_dir, dev, sourcemap, target},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`svelte only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}
		const {id, encoding, contents} = source;
		const outDir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		let preprocessedCode: string;

		// TODO see rollup-plugin-svelte for how to track deps
		// let dependencies = [];
		const preprocessor = getPreprocessor(target, dev, sourcemap);
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
			generate: getGenerateOption(build_config),
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
					? add_js_sourcemap_footer(js.code, jsFilename + SOURCEMAP_EXTENSION)
					: js.code,
				build_config,
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
				build_config,
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
					? add_css_sourcemap_footer(css.code, cssFilename + SOURCEMAP_EXTENSION)
					: css.code,
				build_config,
			});
			if (hasCssSourcemap) {
				builds.push({
					id: cssId + SOURCEMAP_EXTENSION,
					filename: cssFilename + SOURCEMAP_EXTENSION,
					dir: outDir,
					extension: SOURCEMAP_EXTENSION,
					encoding,
					contents: JSON.stringify(css.map), // TODO do we want to also store the object version?
					build_config,
				});
			}
		}
		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	return {name: '@feltcoop/gro-builder-svelte', build};
};

const getGenerateOption = (build_config: Build_Config): 'dom' | 'ssr' | false => {
	switch (build_config.platform) {
		case 'browser':
			return 'dom';
		case 'node':
			return 'ssr';
		default:
			throw new Unreachable_Error(build_config.platform);
	}
};
