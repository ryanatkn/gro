import esbuild from 'esbuild';
import {System_Logger, print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {replace_extension} from '@feltcoop/felt/util/path.js';
import {cyan} from '@feltcoop/felt/util/terminal.js';

import type {Ecma_Script_Target, GenerateTypesForFile} from './ts_build_helpers.js';
import {get_default_esbuild_options} from './esbuild_build_helpers.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	to_build_out_path,
	TS_TYPE_EXTENSION,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import type {Builder, Build_Result, Text_Build, Text_Build_Source} from './builder.js';
import {add_js_sourcemap_footer} from './utils.js';
import {toGenerateTypesForFile} from './ts_build_helpers.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createEsbuildOptions: CreateEsbuildOptions;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	return {
		createEsbuildOptions: createDefaultEsbuildOptions,
		...omit_undefined(opts),
		log: opts.log || new System_Logger(print_log_label('esbuild_builder', cyan)),
	};
};

type EsbuildBuilder = Builder<Text_Build_Source, Text_Build>;

export const create_esbuild_builder = (opts: Initial_Options = {}): EsbuildBuilder => {
	const {createEsbuildOptions} = init_options(opts);

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: Ecma_Script_Target,
		dev: boolean,
		sourcemap: boolean,
	): esbuild.TransformOptions => {
		const key = sourcemap + target;
		const existingEsbuildOptions = esbuildOptionsCache.get(key);
		if (existingEsbuildOptions !== undefined) return existingEsbuildOptions;
		const newEsbuildOptions = createEsbuildOptions(target, dev, sourcemap);
		esbuildOptionsCache.set(key, newEsbuildOptions);
		return newEsbuildOptions;
	};

	let cachedGenerateTypes: Map<Filesystem, Promise<GenerateTypesForFile>> = new Map();
	const loadGenerateTypes = (fs: Filesystem): Promise<GenerateTypesForFile> => {
		if (cachedGenerateTypes.has(fs)) return cachedGenerateTypes.get(fs)!;
		const promise = toGenerateTypesForFile(fs);
		cachedGenerateTypes.set(fs, promise);
		return promise;
	};

	const build: EsbuildBuilder['build'] = async (
		source,
		build_config,
		{build_dir, dev, sourcemap, target, fs},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`esbuild only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const outDir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.contents, esbuildOptions);
		const jsFilename = replace_extension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;
		const builds: Text_Build[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				contents: output.map
					? add_js_sourcemap_footer(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				build_config,
			},
		];
		if (output.map) {
			builds.push({
				id: jsId + SOURCEMAP_EXTENSION,
				filename: jsFilename + SOURCEMAP_EXTENSION,
				dir: outDir,
				extension: SOURCEMAP_EXTENSION,
				encoding: source.encoding,
				contents: output.map,
				build_config,
			});
		}
		// TODO hardcoding to generate types only in production builds, might want to change
		if (!dev) {
			const {types, typemap} = await (await loadGenerateTypes(fs))(source.id);
			builds.push({
				id: replace_extension(jsId, TS_TYPE_EXTENSION),
				filename: replace_extension(jsFilename, TS_TYPE_EXTENSION),
				dir: outDir,
				extension: TS_TYPE_EXTENSION,
				encoding: source.encoding,
				contents: types,
				build_config,
			});
			if (typemap !== undefined) {
				builds.push({
					id: replace_extension(jsId, TS_TYPEMAP_EXTENSION),
					filename: replace_extension(jsFilename, TS_TYPEMAP_EXTENSION),
					dir: outDir,
					extension: TS_TYPEMAP_EXTENSION,
					encoding: source.encoding,
					contents: typemap,
					build_config,
				});
			}
		}
		const result: Build_Result<Text_Build> = {builds};
		return result;
	};

	return {name: '@feltcoop/gro-builder-esbuild', build};
};

type CreateEsbuildOptions = (
	target: Ecma_Script_Target,
	dev: boolean,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const createDefaultEsbuildOptions: CreateEsbuildOptions = (target, dev, sourcemap) =>
	get_default_esbuild_options(target, dev, sourcemap);
