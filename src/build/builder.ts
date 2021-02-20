import {omitUndefined} from '../utils/object.js';
import {UnreachableError} from '../utils/error.js';
import {BuildConfig} from '../config/buildConfig.js';
import {toBuildOutPath, EXTERNALS_BUILD_DIR} from '../paths.js';
import {EcmaScriptTarget} from './tsBuildHelpers.js';
import {ServedDir} from '../build/ServedDir.js';
import type {ExternalsBuilderState} from './externalsBuilder.js';

export interface Builder<TSource extends BuildSource = BuildSource, TBuild extends Build = Build> {
	build(
		source: TSource,
		buildConfig: BuildConfig,
		options: BuildOptions,
	): BuildResult<TBuild> | Promise<BuildResult<TBuild>>;
}

export interface BuildResult<TBuild extends Build = Build> {
	builds: TBuild[];
}
export interface BuildOptions {
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget; // TODO probably make this overrideable by each build config
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly externalsDirBasePath: string;
	readonly servedDirs: readonly ServedDir[];
	readonly state: BuilderState;
	readonly buildingSourceFiles: Set<string>;
}
export interface BuilderState {
	[EXTERNALS_BUILD_DIR]?: ExternalsBuilderState;
}

export type Build = TextBuild | BinaryBuild;
export interface TextBuild extends BaseBuild {
	encoding: 'utf8';
	contents: string;
	sourceMapOf: string | null; // TODO for source maps? hmm. maybe we want a union with an `isSourceMap` boolean flag?
}
export interface BinaryBuild extends BaseBuild {
	encoding: null;
	contents: Buffer;
}
interface BaseBuild {
	id: string;
	filename: string;
	dir: string;
	extension: string;
	buildConfig: BuildConfig;
}

export type BuildSource = TextBuildSource | BinaryBuildSource | ExternalsBuildSource;
export interface TextBuildSource extends BaseBuildSource {
	sourceType: 'text';
	encoding: 'utf8';
	contents: string;
}
export interface BinaryBuildSource extends BaseBuildSource {
	sourceType: 'binary';
	encoding: null;
	contents: Buffer;
}
export interface ExternalsBuildSource extends BaseBuildSource {
	sourceType: 'externals';
	encoding: 'utf8';
	contents: string;
}
interface BaseBuildSource {
	id: string;
	filename: string;
	dir: string;
	dirBasePath: string;
	extension: string;
}

export interface GetBuilder {
	(source: BuildSource, buildConfig: BuildConfig): Builder | null;
}

export interface Options {
	getBuilder: GetBuilder;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		getBuilder: getNoopBuilder,
		...omitUndefined(opts),
	};
};

export const createBuilder = (opts: InitialOptions = {}): Builder => {
	const {getBuilder} = initOptions(opts);

	const build: Builder['build'] = (
		source: BuildSource,
		buildConfig: BuildConfig,
		options: BuildOptions,
	) => {
		const builder = getBuilder(source, buildConfig) || noopBuilder;
		return builder.build(source, buildConfig, options);
	};

	return {build};
};

const noopBuilder: Builder = {
	build: (source, buildConfig, {buildRootDir, dev}) => {
		const {filename, extension} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildRootDir);
		const id = `${outDir}${filename}`;
		let file: Build;
		switch (source.encoding) {
			case 'utf8':
				file = {
					id,
					filename,
					dir: outDir,
					extension,
					encoding: source.encoding,
					contents: source.contents,
					sourceMapOf: null,
					buildConfig,
				};
				break;
			case null:
				file = {
					id,
					filename,
					dir: outDir,
					extension,
					encoding: source.encoding,
					contents: source.contents,
					buildConfig,
				};
				break;
			default:
				throw new UnreachableError(source);
		}
		return {builds: [file]};
	},
};
const getNoopBuilder: GetBuilder = () => noopBuilder;
