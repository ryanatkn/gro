import {UnreachableError} from '../utils/error.js';
import {BuildConfig} from '../config/buildConfig.js';
import {toBuildOutPath, EXTERNALS_BUILD_DIR} from '../paths.js';
import type {ExternalsBuilderState} from './externalsBuilder.js';
import {EcmaScriptTarget} from './tsBuildHelpers.js';
import {ServedDir} from './ServedDir.js';
import {Logger} from '../utils/log.js';

export interface Builder<TSource extends BuildSource = BuildSource, TBuild extends Build = Build> {
	build(
		source: TSource,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	): BuildResult<TBuild> | Promise<BuildResult<TBuild>>; // TODO should this be forced async?
	onRemove?(source: TSource, buildConfig: BuildConfig, ctx: BuildContext): Promise<void>;
}

export interface BuildResult<TBuild extends Build = Build> {
	builds: TBuild[];
}

export interface BuildContext {
	readonly log: Logger;
	readonly buildRootDir: string;
	readonly dev: boolean;
	readonly sourceMap: boolean;
	readonly target: EcmaScriptTarget;
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
	common?: boolean;
}

export type BuildSource = TextBuildSource | BinaryBuildSource;
export interface TextBuildSource extends BaseBuildSource {
	encoding: 'utf8';
	contents: string;
}
export interface BinaryBuildSource extends BaseBuildSource {
	encoding: null;
	contents: Buffer;
}
interface BaseBuildSource {
	buildable: true;
	external: boolean;
	id: string;
	filename: string;
	dir: string;
	dirBasePath: string;
	extension: string;
}

export const noopBuilder: Builder = {
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
		const result: BuildResult = {builds: [file]};
		return result;
	},
	// onRemove: not implemented because it's a no-op
};
