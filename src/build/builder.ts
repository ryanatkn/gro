import type {Logger} from '@feltcoop/felt/util/log.js';

import type {Build_Config, Build_Name} from 'src/build/build_config.js';
import type {
	Externals_Aliases,
	Externals_Builder_State,
	EXTERNALS_BUILDER_STATE_KEY,
} from './externals_build_helpers.js';
import type {Ecma_Script_Target} from 'src/build/ts_build_helpers.js';
import type {Served_Dir} from 'src/build/served_dir.js';
import type {Source_Meta} from 'src/build/source_meta.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import type {Base_Filer_File} from 'src/build/filer_file.js';
import type {Build_File} from 'src/build/build_file.js';

export interface Builder<TSource extends Build_Source = Build_Source> {
	name: string;
	build(
		source: TSource,
		build_config: Build_Config,
		ctx: Build_Context,
	): Build_File[] | Promise<Build_File[]>; // TODO should this be forced async?
	on_remove?(source: TSource, build_config: Build_Config, ctx: Build_Context): Promise<void>;
	init?(ctx: Build_Context): Promise<void>;
}

// For docs on these, see where they're implemented in the `Filer`.
export interface Build_Context {
	readonly fs: Filesystem;
	readonly build_configs: readonly Build_Config[] | null;
	readonly build_names: Set<Build_Name> | null;
	readonly source_meta_by_id: Map<string, Source_Meta>;
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly types: boolean;
	readonly target: Ecma_Script_Target;
	readonly served_dirs: readonly Served_Dir[];
	readonly externals_aliases: Externals_Aliases;
	readonly state: Builder_State;
	readonly building_source_files: Set<string>;
	readonly find_by_id: (id: string) => Base_Filer_File | undefined;
}

export interface Builder_State {
	[EXTERNALS_BUILDER_STATE_KEY]?: Externals_Builder_State;
}

export type Build_Source = Text_Build_Source | Binary_Build_Source;
export interface Text_Build_Source extends Base_Build_Source {
	encoding: 'utf8';
	content: string;
}
export interface Binary_Build_Source extends Base_Build_Source {
	encoding: null;
	content: Buffer;
}
interface Base_Build_Source {
	buildable: true;
	id: string;
	filename: string;
	dir: string;
	dir_base_path: string;
	extension: string;
}
