import {rollup, OutputOptions, InputOptions, OutputChunk} from 'rollup';
import resolvePlugin from '@rollup/plugin-node-resolve';
import commonjsPlugin from '@rollup/plugin-commonjs';

import {diagnosticsPlugin} from '../project/rollup-plugin-diagnostics.js';

export const buildExternalModule = async (
	originalImportPath: string,
	externalFilePath: string,
): Promise<OutputChunk> => {
	const inputOptions = createInputOptions(originalImportPath);
	const outputOptions = createOutputOptions(externalFilePath, false);

	const build = await rollup(inputOptions);

	const generated = await build.generate(outputOptions);

	if (generated.output.length !== 1) {
		throw Error(`Expected one generated chunk, got ${generated.output.length}`);
	}

	return generated.output[0];
};

const createInputOptions = (input: string): InputOptions => {
	const inputOptions: InputOptions = {
		// >> core input options
		// external,
		input, // required
		plugins: [diagnosticsPlugin(), resolvePlugin(), commonjsPlugin()],

		// >> advanced input options
		// cache,
		// onwarn,
		// preserveEntrySignatures,
		// strictDeprecations,

		// >> danger zone
		// acorn,
		// acornInjectPlugins,
		// context,
		// moduleContext,
		// preserveSymlinks,
		// shimMissingExports,
		// treeshake,

		// >> experimental
		// experimentalCacheExpiry,
		// perf
	};
	// log.trace('inputOptions', inputOptions);
	return inputOptions;
};

const createOutputOptions = (file: string, sourcemap: boolean): OutputOptions => {
	const outputOptions: OutputOptions = {
		// >> core output options
		// dir,
		file,
		format: 'esm', // required
		// globals,
		// name,
		// plugins,

		// >> advanced output options
		// assetFileNames,
		// banner,
		// chunkFileNames,
		// compact,
		// entryFileNames,
		// extend,
		// footer,
		// hoistTransitiveImports,
		// inlineDynamicImports,
		// interop,
		// intro,
		// manualChunks,
		// minifyInternalExports,
		// outro,
		// paths,
		// preserveModules,
		// preserveModulesRoot,
		sourcemap,
		// sourcemapExcludeSources,
		// sourcemapFile,
		// sourcemapPathTransform,

		// >> danger zone
		// amd,
		// esModule,
		// exports,
		// externalLiveBindings,
		// freeze,
		// indent,
		// namespaceToStringTag,
		// noConflict,
		// preferConst,
		// strict,
		// systemNullSetters,
	};
	return outputOptions;
};
