import type {Logger} from '@feltjs/util/log.js';

import type {BuildConfig, BuildName} from './build_config.js';
import type {EcmaScriptTarget} from './helpers.js';
import type {SourceMeta} from './source_meta.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {BaseFilerFile} from './filer_file.js';
import type {BuildFile} from './build_file.js';
import type {Paths} from '../path/paths.js';
import type {SourceFile} from './source_file.js';

export interface Builder<TSource extends SourceFile = SourceFile> {
	name: string;
	build: (
		source: TSource,
		build_config: BuildConfig,
		ctx: BuildContext,
	) => BuildFile[] | Promise<BuildFile[]>; // TODO should this be forced async?
	on_remove?: (source: TSource, build_config: BuildConfig, ctx: BuildContext) => Promise<void>;
	init?: (ctx: BuildContext) => Promise<void>;
}

// For docs on these, see where they're implemented in the `Filer`.
export interface BuildContext {
	readonly fs: Filesystem;
	readonly paths: Paths;
	readonly build_configs: readonly BuildConfig[] | null;
	readonly build_names: Set<BuildName> | null;
	readonly source_meta_by_id: Map<string, SourceMeta>;
	readonly log: Logger;
	readonly build_dir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget;
	readonly building_source_files: Set<string>;
	readonly find_by_id: (id: string) => BaseFilerFile | undefined;
}
