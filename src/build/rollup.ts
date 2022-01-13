import type {
	OutputOptions as RollupOutputOptions,
	InputOptions as RollupInputOptions,
	InputOption as RollupInputOption,
	RollupWatchOptions as RollupWatchOptions,
	RollupOutput as RollupOutput,
	RollupBuild as RollupBuild,
} from 'rollup';
import {rollup, watch} from 'rollup';
import resolvePlugin from '@rollup/plugin-node-resolve';
import commonjsPlugin from '@rollup/plugin-commonjs';
import {rainbow} from '@feltcoop/felt/util/terminal.js';
import {SystemLogger} from '@feltcoop/felt/util/log.js';
import {printLogLabel} from '@feltcoop/felt/util/log.js';
import {type Logger} from '@feltcoop/felt/util/log.js';
import {deindent} from '@feltcoop/felt/util/string.js';
import {omitUndefined} from '@feltcoop/felt/util/object.js';
import {UnreachableError} from '@feltcoop/felt/util/error.js';
import {identity} from '@feltcoop/felt/util/function.js';
import {type PartialExcept} from '@feltcoop/felt/util/types.js';

import {rollupPluginGroDiagnostics} from './rollupPluginGroDiagnostics.js';
import {paths} from '../paths.js';
import {rollupPluginGroOutputCss} from './rollupPluginGroOutputCss.js';
import {type Filesystem} from 'src/fs/filesystem.js';
import {rollupPluginGroPlainCss} from './rollupPluginGroPlainCss.js';
import {type CssCache} from 'src/build/cssCache.js';
import {createCssCache} from './cssCache.js';
import {type GroCssBuild} from 'src/build/groCssBuild.js';
import {rollupPluginGroSvelte} from './rollupPluginGroSvelte.js';
import {createDefaultPreprocessor} from './groBuilderSvelteUtils.js';
import {type EcmaScriptTarget} from 'src/build/typescriptUtils.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from './buildConfigDefaults.js';

export interface Options {
	fs: Filesystem;
	input: RollupInputOption;
	dev: boolean;
	target: EcmaScriptTarget;
	sourcemap: boolean;
	outputDir: string;
	watch: boolean;
	mapInputOptions: MapInputOptions;
	mapOutputOptions: MapOutputOptions;
	mapWatchOptions: MapWatchOptions;
	cssCache: CssCache<GroCssBuild>;
	log: Logger;
}
export type RequiredOptions = 'fs' | 'input';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	dev: true,
	target: DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap: opts.dev ?? true,
	outputDir: paths.dist,
	watch: false,
	mapInputOptions: identity,
	mapOutputOptions: identity,
	mapWatchOptions: identity,
	cssCache: opts.cssCache || createCssCache(),
	...omitUndefined(opts),
	log: opts.log || new SystemLogger(printLogLabel('build')),
});

export type MapInputOptions = (
	r: RollupInputOptions,
	o: Options,
) => RollupInputOptions | Promise<RollupInputOptions>;
export type MapOutputOptions = (
	r: RollupOutputOptions,
	o: Options,
) => RollupOutputOptions | Promise<RollupOutputOptions>;
export type MapWatchOptions = (
	r: RollupWatchOptions,
	o: Options,
) => RollupWatchOptions | Promise<RollupWatchOptions>;

export const runRollup = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	const {log} = options;

	log.info(`building for ${options.dev ? 'development' : 'production'}`);
	log.trace('build options', options);

	if (options.watch) {
		// run the watcher
		log.info('building and watching');
		await runRollupWatcher(options, log);
		log.info('stopped watching');
	} else {
		// build without watching
		log.info('building');
		await runRollupBuild(options, log);
		log.info(
			'\n' +
				rainbow(
					deindent(`
						~~~~~~~~~~~~~~~~~
						~~❤~~ built ~~❤~~
						~~~~~~~~~~~~~~~~~
				`),
				),
		);
	}
};

const createInputOptions = async (options: Options): Promise<RollupInputOptions> => {
	const {fs, cssCache, dev, target, sourcemap} = options;

	const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
	const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');

	const unmappedInputOptions: RollupInputOptions = {
		input: options.input,
		plugins: [
			rollupPluginGroDiagnostics(),
			rollupPluginGroSvelte({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(dev, target, sourcemap),
				compileOptions: {},
			}),
			rollupPluginGroPlainCss({fs, addCssBuild: addPlainCssBuild}),
			rollupPluginGroOutputCss({
				fs,
				getCssBundles: cssCache.getCssBundles,
				sourcemap,
			}),
			resolvePlugin({preferBuiltins: true}),
			commonjsPlugin(),
		],
	};
	return options.mapInputOptions(unmappedInputOptions, options);
};

const createOutputOptions = async (options: Options): Promise<RollupOutputOptions> => {
	const unmappedOutputOptions: RollupOutputOptions = {
		dir: options.outputDir,
		format: 'esm',
		name: 'app',
		sourcemap: options.sourcemap,
		generatedCode: 'es2015',
	};
	return options.mapOutputOptions(unmappedOutputOptions, options);
};

const createWatchOptions = async (options: Options): Promise<RollupWatchOptions> => {
	const unmappedWatchOptions: RollupWatchOptions = {
		...createInputOptions(options),
		output: await createOutputOptions(options),
		watch: {
			clearScreen: false,
			exclude: ['node_modules/**'],
		},
	};
	return options.mapWatchOptions(unmappedWatchOptions, options);
};

interface RollupBuildResult {
	build: RollupBuild;
	output: RollupOutput;
}

const runRollupBuild = async (options: Options, log: Logger): Promise<RollupBuildResult> => {
	const inputOptions = await createInputOptions(options);
	const outputOptions = await createOutputOptions(options);
	log.trace('inputOptions', inputOptions);
	log.trace('outputOptions', outputOptions);
	const build = await rollup(inputOptions);
	const output = await build.write(outputOptions);
	return {build, output};
};

const runRollupWatcher = async (options: Options, log: Logger): Promise<void> => {
	return new Promise(async (_resolve, reject) => {
		const watchOptions = await createWatchOptions(options);
		const watcher = watch(watchOptions);

		watcher.on('event', (event) => {
			log.info(`rollup event: ${event.code}`);
			switch (event.code) {
				case 'START': // the watcher is (re)starting
				case 'BUNDLE_START': // building an individual bundle
				case 'BUNDLE_END': // finished building a bundle
					break;
				case 'END': // finished building all bundles
					log.info(rainbow('~~end~~'), '\n\n');
					break;
				case 'ERROR': // encountered an error while bundling
					log.error('error', event);
					reject(`Error: ${event.error.message}`);
					break;
				default:
					throw new UnreachableError(event);
			}
		});

		// call this ever? teardown
		// watcher.close();
	});
};
