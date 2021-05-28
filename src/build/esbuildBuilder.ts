import esbuild from 'esbuild';
import {SystemLogger, printLogLabel} from '@feltcoop/felt/dist/utils/log.js';
import type {Logger} from '@feltcoop/felt/dist/utils/log.js';
import {omitUndefined} from '@feltcoop/felt/dist/utils/object.js';
import {replaceExtension} from '@feltcoop/felt/dist/utils/path.js';
import {cyan} from '@feltcoop/felt/dist/utils/terminal.js';

import type {EcmaScriptTarget, GenerateTypesForFile} from './tsBuildHelpers.js';
import {getDefaultEsbuildOptions} from './esbuildBuildHelpers.js';
import {
	JS_EXTENSION,
	SOURCEMAP_EXTENSION,
	toBuildOutPath,
	TS_TYPE_EXTENSION,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import type {Builder, BuildResult, TextBuild, TextBuildSource} from './builder.js';
import {addJsSourcemapFooter} from './utils.js';
import {toGenerateTypesForFile} from './tsBuildHelpers.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface Options {
	log: Logger;
	// TODO changes to this by consumers can break caching - how can the DX be improved?
	createEsbuildOptions: CreateEsbuildOptions;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		createEsbuildOptions: createDefaultEsbuildOptions,
		...omitUndefined(opts),
		log: opts.log || new SystemLogger(printLogLabel('esbuildBuilder', cyan)),
	};
};

type EsbuildBuilder = Builder<TextBuildSource, TextBuild>;

export const createEsbuildBuilder = (opts: InitialOptions = {}): EsbuildBuilder => {
	const {createEsbuildOptions} = initOptions(opts);

	const esbuildOptionsCache: Map<string, esbuild.TransformOptions> = new Map();
	const getEsbuildOptions = (
		target: EcmaScriptTarget,
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
		buildConfig,
		{buildDir, dev, sourcemap, target, fs},
	) => {
		if (source.encoding !== 'utf8') {
			throw Error(`esbuild only handles utf8 encoding, not ${source.encoding}`);
		}
		if (source.extension !== TS_EXTENSION) {
			throw Error(`esbuild only handles ${TS_EXTENSION} files, not ${source.extension}`);
		}
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		const esbuildOptions = {
			...getEsbuildOptions(target, dev, sourcemap),
			sourcefile: source.id,
		};
		const output = await esbuild.transform(source.contents, esbuildOptions);
		const jsFilename = replaceExtension(source.filename, JS_EXTENSION);
		const jsId = `${outDir}${jsFilename}`;
		const builds: TextBuild[] = [
			{
				id: jsId,
				filename: jsFilename,
				dir: outDir,
				extension: JS_EXTENSION,
				encoding: source.encoding,
				contents: output.map
					? addJsSourcemapFooter(output.code, jsFilename + SOURCEMAP_EXTENSION)
					: output.code,
				buildConfig,
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
				buildConfig,
			});
		}
		// TODO hardcoding to generate types only in production builds, might want to change
		if (!dev) {
			const {types, typemap} = await (await loadGenerateTypes(fs))(source.id);
			builds.push({
				id: replaceExtension(jsId, TS_TYPE_EXTENSION),
				filename: replaceExtension(jsFilename, TS_TYPE_EXTENSION),
				dir: outDir,
				extension: TS_TYPE_EXTENSION,
				encoding: source.encoding,
				contents: types,
				buildConfig,
			});
			if (typemap !== undefined) {
				builds.push({
					id: replaceExtension(jsId, TS_TYPEMAP_EXTENSION),
					filename: replaceExtension(jsFilename, TS_TYPEMAP_EXTENSION),
					dir: outDir,
					extension: TS_TYPEMAP_EXTENSION,
					encoding: source.encoding,
					contents: typemap,
					buildConfig,
				});
			}
		}
		const result: BuildResult<TextBuild> = {builds};
		return result;
	};

	return {name: '@feltcoop/gro-builder-esbuild', build};
};

type CreateEsbuildOptions = (
	target: EcmaScriptTarget,
	dev: boolean,
	sourcemap: boolean,
) => esbuild.TransformOptions;

const createDefaultEsbuildOptions: CreateEsbuildOptions = (target, dev, sourcemap) =>
	getDefaultEsbuildOptions(target, dev, sourcemap);
