import {UnreachableError} from '../utils/error.js';
import type {BuildConfig} from '../build/buildConfig.js';
import {toBuildOutPath} from '../paths.js';
import type {
	ExternalsAliases,
	ExternalsBuilderState,
	EXTERNALS_BUILDER_STATE_KEY,
} from './externalsBuildHelpers.js';
import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import type {ServedDir} from './servedDir.js';
import type {Logger} from '../utils/log.js';
import type {SourceMeta} from './sourceMeta.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {BaseFilerFile} from './baseFilerFile.js';

export interface Builder<TSource extends BuildSource = BuildSource, TBuild extends Build = Build> {
	name: string;
	build(
		source: TSource,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	): BuildResult<TBuild> | Promise<BuildResult<TBuild>>; // TODO should this be forced async?
	onRemove?(source: TSource, buildConfig: BuildConfig, ctx: BuildContext): Promise<void>;
	init?(ctx: BuildContext): Promise<void>;
}

export interface BuildResult<TBuild extends Build = Build> {
	builds: TBuild[];
}

// For docs on these, see where they're implemented in the `Filer`.
export interface BuildContext {
	readonly fs: Filesystem;
	readonly buildConfigs: readonly BuildConfig[] | null;
	readonly sourceMetaById: Map<string, SourceMeta>;
	readonly log: Logger;
	readonly buildDir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget;
	readonly servedDirs: readonly ServedDir[];
	readonly externalsAliases: ExternalsAliases;
	readonly state: BuilderState;
	readonly buildingSourceFiles: Set<string>;
	readonly findById: (id: string) => BaseFilerFile | null;
}

export interface BuilderState {
	[EXTERNALS_BUILDER_STATE_KEY]?: ExternalsBuilderState;
}

export type Build = TextBuild | BinaryBuild;
export interface TextBuild extends BaseBuild {
	encoding: 'utf8';
	contents: string;
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
	id: string;
	filename: string;
	dir: string;
	dirBasePath: string;
	extension: string;
}

export const noopBuilder: Builder = {
	name: '@feltcoop/gro-builder-noop',
	build: (source, buildConfig, {buildDir, dev}) => {
		const {filename, extension} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
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
	// init: not implemented because it's a no-op
};

// TODO maybe move to `buildFile`? but then `postprocess` would have a dependency on the build file.
// its imports make more sense as is.
export interface BuildDependency {
	specifier: string;
	mappedSpecifier: string;
	buildId: string;
	external: boolean;
}
