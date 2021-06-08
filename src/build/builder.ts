import {UnreachableError} from '@feltcoop/felt/utils/error.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';

import type {Build_Config} from '../build/build_config.js';
import {to_build_out_path} from '../paths.js';
import type {
	ExternalsAliases,
	ExternalsBuilderState,
	EXTERNALS_BUILDER_STATE_KEY,
} from './externalsBuildHelpers.js';
import type {EcmaScriptTarget} from './tsBuildHelpers.js';
import type {ServedDir} from './served_dir.js';
import type {SourceMeta} from './sourceMeta.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {BaseFilerFile} from './baseFilerFile.js';

export interface Builder<TSource extends BuildSource = BuildSource, TBuild extends Build = Build> {
	name: string;
	build(
		source: TSource,
		build_config: Build_Config,
		ctx: BuildContext,
	): BuildResult<TBuild> | Promise<BuildResult<TBuild>>; // TODO should this be forced async?
	onRemove?(source: TSource, build_config: Build_Config, ctx: BuildContext): Promise<void>;
	init?(ctx: BuildContext): Promise<void>;
}

export interface BuildResult<TBuild extends Build = Build> {
	builds: TBuild[];
}

// For docs on these, see where they're implemented in the `Filer`.
export interface BuildContext {
	readonly fs: Filesystem;
	readonly build_configs: readonly Build_Config[] | null;
	readonly sourceMetaById: Map<string, SourceMeta>;
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget;
	readonly served_dirs: readonly ServedDir[];
	readonly externalsAliases: ExternalsAliases;
	readonly state: BuilderState;
	readonly buildingSourceFiles: Set<string>;
	readonly findById: (id: string) => BaseFilerFile | undefined;
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
	build_config: Build_Config;
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
	dir_base_path: string;
	extension: string;
}

export const noopBuilder: Builder = {
	name: '@feltcoop/gro-builder-noop',
	build: (source, build_config, {build_dir, dev}) => {
		const {filename, extension} = source;
		const outDir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
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
					build_config,
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
					build_config,
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
	build_id: string;
	external: boolean;
}
