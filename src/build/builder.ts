import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import type {Logger} from '@feltcoop/felt/util/log.js';

import type {Build_Config, Build_Name} from '../build/build_config.js';
import {to_build_out_path} from '../paths.js';
import type {
	Externals_Aliases,
	Externals_Builder_State,
	EXTERNALS_BUILDER_STATE_KEY,
} from './externals_build_helpers.js';
import type {Ecma_Script_Target} from './ts_build_helpers.js';
import type {Served_Dir} from './served_dir.js';
import type {Source_Meta} from './source_meta.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {Base_Filer_File} from './base_filer_file.js';

export interface Builder<
	TSource extends Build_Source = Build_Source,
	TBuild extends Build = Build,
> {
	name: string;
	build(
		source: TSource,
		build_config: Build_Config,
		ctx: Build_Context,
	): Build_Result<TBuild> | Promise<Build_Result<TBuild>>; // TODO should this be forced async?
	on_remove?(source: TSource, build_config: Build_Config, ctx: Build_Context): Promise<void>;
	init?(ctx: Build_Context): Promise<void>;
}

export interface Build_Result<TBuild extends Build = Build> {
	builds: TBuild[];
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

export type Build = Text_Build | Binary_Build;
export interface Text_Build extends BaseBuild {
	encoding: 'utf8';
	content: string;
}
export interface Binary_Build extends BaseBuild {
	encoding: null;
	content: Buffer;
}
interface BaseBuild {
	id: string;
	filename: string;
	dir: string;
	extension: string;
	build_config: Build_Config;
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

export const noop_builder: Builder = {
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
					content: source.content,
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
					content: source.content,
					build_config,
				};
				break;
			default:
				throw new Unreachable_Error(source);
		}
		const result: Build_Result = {builds: [file]};
		return result;
	},
	// on_remove: not implemented because it's a no-op
	// init: not implemented because it's a no-op
};
