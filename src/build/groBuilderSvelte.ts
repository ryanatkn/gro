import * as svelte from 'svelte/compiler';
import type {PreprocessorGroup as SveltePreprocessorGroup} from 'svelte/types/compiler/preprocess';
import type {CompileOptions as SvelteCompileOptions} from 'svelte/types/compiler/interfaces';
import {printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';
import {type Logger} from '@feltcoop/felt/util/log.js';
import {UnreachableError} from '@feltcoop/felt/util/error.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import {type EcmaScriptTarget} from 'src/build/typescriptUtils.js';
import {
	baseSvelteCompileOptions,
	createDefaultPreprocessor,
	handleStats,
	handleWarn,
} from './groBuilderSvelteUtils.js';
import type {CreatePreprocessor, SvelteCompilation} from 'src/build/groBuilderSvelteUtils.js';
import {
	CSS_EXTENSION,
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	SVELTE_EXTENSION,
	toBuildOutPath,
} from '../paths.js';
import type {Builder, TextBuildSource} from 'src/build/builder.js';
import {type BuildConfig} from 'src/build/buildConfig.js';
import {addCssSourcemapFooter, addJsSourcemapFooter} from './utils.js';
import {type BuildFile} from 'src/build/buildFile.js';
import {postprocess} from './postprocess.js';

// TODO build types in production unless `declarations` is `false`,
// so they'll be automatically copied into unbundled production dists

export interface Options {
	log?: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createPreprocessor?: CreatePreprocessor;
	// TODO how to support options like this without screwing up caching?
	// maybe compilers need a way to declare their options so they (or a hash) can be cached?
	svelteCompileOptions?: SvelteCompileOptions;
	onwarn?: typeof handleWarn;
	onstats?: typeof handleStats | null;
}

type SvelteBuilder = Builder<TextBuildSource>;

export const groBuilderSvelte = (options: Options = {}): SvelteBuilder => {
	const {
		log = new SystemLogger(printLogLabel('svelteBuilder', cyan)),
		createPreprocessor = createDefaultPreprocessor,
		svelteCompileOptions,
		onwarn = handleWarn,
		onstats = null,
	} = options;

	const preprocessorCache: Map<string, SveltePreprocessorGroup | SveltePreprocessorGroup[] | null> =
		new Map();
	const getPreprocessor = (
		target: EcmaScriptTarget,
		dev: boolean,
		sourcemap: boolean,
	): SveltePreprocessorGroup | SveltePreprocessorGroup[] | null => {
		const key = sourcemap + target;
		const existingPreprocessor = preprocessorCache.get(key);
		if (existingPreprocessor !== undefined) return existingPreprocessor;
		const newPreprocessor = createPreprocessor(dev, target, sourcemap);
		preprocessorCache.set(key, newPreprocessor);
		return newPreprocessor;
	};

	const build: SvelteBuilder['build'] = async (source, buildConfig, ctx) => {
		const {buildDir, dev, sourcemap, target} = ctx;

		if (source.encoding !== 'utf8') {
			throw Error(`svelte only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== SVELTE_EXTENSION) {
			throw Error(`svelte only handles ${SVELTE_EXTENSION} files, not ${source.extension}`);
		}

		const {id, encoding, content} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);

		// for production builds, output uncompiled Svelte
		// TODO what about non-TypeScript preprocessors?
		if (!dev) {
			const buildFiles: BuildFile[] = [
				{
					type: 'build',
					sourceId: source.id,
					buildConfig,
					dependencies: null,
					id: `${outDir}${source.filename}`,
					filename: source.filename,
					dir: outDir,
					extension: SVELTE_EXTENSION,
					encoding,
					content: source.content,
					contentBuffer: undefined,
					contentHash: undefined,
					stats: undefined,
					mimeType: undefined,
				},
			];
			await Promise.all(
				buildFiles.map((buildFile) => postprocess(buildFile, ctx, buildFiles, source)),
			);
			return buildFiles;
		}

		let preprocessedCode: string;

		// TODO see rollup-plugin-svelte for how to track deps
		// let dependencies = [];
		const preprocessor = getPreprocessor(target, dev, sourcemap);
		if (preprocessor !== null) {
			const preprocessed = await svelte.preprocess(content, preprocessor, {filename: id});
			preprocessedCode = preprocessed.code;
			// dependencies = preprocessed.dependencies; // TODO
		} else {
			preprocessedCode = content;
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

		const buildFiles: BuildFile[] = [
			{
				type: 'build',
				sourceId: source.id,
				buildConfig,
				dependencies: null,
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding,
				content: hasJsSourcemap
					? addJsSourcemapFooter(js.code, jsFilename + SOURCEMAP_EXTENSION)
					: js.code,
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			},
		];
		if (hasJsSourcemap) {
			buildFiles.push({
				type: 'build',
				sourceId: source.id,
				buildConfig,
				dependencies: null,
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding,
				content: JSON.stringify(js.map), // TODO do we want to also store the object version?
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			});
		}
		if (css.code) {
			buildFiles.push({
				type: 'build',
				sourceId: source.id,
				buildConfig,
				dependencies: null,
				id: cssId,
				filename: cssFilename,
				dir: outDir,
				extension: CSS_EXTENSION,
				encoding,
				content: hasCssSourcemap
					? addCssSourcemapFooter(css.code, cssFilename + SOURCEMAP_EXTENSION)
					: css.code,
				contentBuffer: undefined,
				contentHash: undefined,
				stats: undefined,
				mimeType: undefined,
			});
			if (hasCssSourcemap) {
				buildFiles.push({
					type: 'build',
					sourceId: source.id,
					buildConfig,
					dependencies: null,
					id: cssId + SOURCEMAP_EXTENSION,
					filename: cssFilename + SOURCEMAP_EXTENSION,
					dir: outDir,
					extension: SOURCEMAP_EXTENSION,
					encoding,
					content: JSON.stringify(css.map), // TODO do we want to also store the object version?
					contentBuffer: undefined,
					contentHash: undefined,
					stats: undefined,
					mimeType: undefined,
				});
			}
		}

		await Promise.all(
			buildFiles.map((buildFile) => postprocess(buildFile, ctx, buildFiles, source)),
		);
		return buildFiles;
	};

	return {name: '@feltcoop/groBuilderSvelte', build};
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
