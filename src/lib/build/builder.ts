import type {Logger} from '@feltjs/util/log.js';

import type {BuildConfig, BuildName} from './buildConfig.js';
import type {EcmaScriptTarget} from './helpers.js';
import type {SourceMeta} from './sourceMeta.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {BaseFilerFile} from './filerFile.js';
import type {BuildFile} from './buildFile.js';
import type {Paths} from '../path/paths.js';

export interface Builder<TSource extends BuildSource = BuildSource> {
	name: string;
	build: (
		source: TSource,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	) => BuildFile[] | Promise<BuildFile[]>; // TODO should this be forced async?
	onRemove?: (source: TSource, buildConfig: BuildConfig, ctx: BuildContext) => Promise<void>;
	init?: (ctx: BuildContext) => Promise<void>;
}

// For docs on these, see where they're implemented in the `Filer`.
export interface BuildContext {
	readonly fs: Filesystem;
	readonly paths: Paths;
	readonly buildConfigs: readonly BuildConfig[] | null;
	readonly buildNames: Set<BuildName> | null;
	readonly sourceMetaById: Map<string, SourceMeta>;
	readonly log: Logger;
	readonly buildDir: string;
	readonly dev: boolean;
	readonly sourcemap: boolean;
	readonly target: EcmaScriptTarget;
	readonly buildingSourceFiles: Set<string>;
	readonly findById: (id: string) => BaseFilerFile | undefined;
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
	id: string;
	filename: string;
	dir: string;
	dirBasePath: string;
	extension: string;
}