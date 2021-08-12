import type {Logger} from '@feltcoop/felt/util/log.js';

import type {BuildConfig, BuildName} from 'src/build/build_config.js';
import type {
	ExternalsAliases,
	ExternalsBuilderState,
	EXTERNALS_BUILDER_STATE_KEY,
} from './gro_builder_externals_utils.js';
import type {EcmaScriptTarget} from 'src/build/typescript_utils.js';
import type {ServedDir} from 'src/build/served_dir.js';
import type {SourceMeta} from 'src/build/source_meta.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import type {BaseFilerFile} from 'src/build/filer_file.js';
import type {BuildFile} from 'src/build/build_file.js';

export interface Builder<TSource extends BuildSource = BuildSource> {
	name: string;
	build(
		source: TSource,
		build_config: BuildConfig,
		ctx: BuildContext,
	): BuildFile[] | Promise<BuildFile[]>; // TODO should this be forced async?
	on_remove?(source: TSource, build_config: BuildConfig, ctx: BuildContext): Promise<void>;
	init?(ctx: BuildContext): Promise<void>;
}

// For docs on these, see where they're implemented in the `Filer`.
export interface BuildContext {
	readonly fs: Filesystem;
	readonly build_configs: readonly BuildConfig[] | null;
	readonly build_names: Set<BuildName> | null;
	readonly source_meta_by_id: Map<string, SourceMeta>;
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly types: boolean;
	readonly target: EcmaScriptTarget;
	readonly served_dirs: readonly ServedDir[];
	readonly externals_aliases: ExternalsAliases;
	readonly state: BuilderState;
	readonly building_source_files: Set<string>;
	readonly find_by_id: (id: string) => BaseFilerFile | undefined;
}

export interface BuilderState {
	[EXTERNALS_BUILDER_STATE_KEY]?: ExternalsBuilderState;
}

export type BuildSource = TextBuildSource | BinaryBuildSource;
export interface TextBuildSource extends BaseBuildSource {
	encoding: 'utf8';
	content: string;
}
export interface BinaryBuildSource extends BaseBuildSource {
	encoding: null;
	content: Buffer;
}
interface BaseBuildSource {
	buildable: true;
	id: string;
	filename: string;
	dir: string;
	dir_base_path: string;
	extension: string;
}
