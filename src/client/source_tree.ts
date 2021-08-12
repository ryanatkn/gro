import {deep_equal} from '@feltcoop/felt/util/equal.js';

import type {SourceMeta, SourceMetaBuild} from 'src/build/source_meta.js';
import type {BuildConfig, BuildName} from 'src/build/build_config.js';

export interface SourceTree {
	// readonly children: SourceTreeNode[];
	readonly metas: SourceTreeMeta[];
	readonly metas_by_build_name: Map<string, SourceTreeMeta[]>;
	readonly builds_by_build_name: Map<string, SourceMetaBuild[]>;
	readonly build_configs: readonly BuildConfig[];
	readonly build_names: string[]; // for convenience, same as keys of `builds_by_build_name`
	readonly builds: SourceMetaBuild[];
}

export interface SourceTreeMeta extends SourceMeta {
	readonly builds_by_build_name: Map<string, SourceMetaBuild[]>;
	readonly build_names: string[]; // for convenience, same as keys of `builds_by_build_name`
}

// export interface SourceTreeNode {
// 	children?: SourceTreeNode[];
// }

export const create_source_tree = (
	source_meta: SourceMeta[],
	build_configs: readonly BuildConfig[],
): SourceTree => {
	const metas = to_source_tree_meta(
		source_meta.sort((a, b) => (a.data.source_id > b.data.source_id ? 1 : -1)),
	);
	const builds: SourceMetaBuild[] = [];
	const builds_by_build_name: Map<string, SourceMetaBuild[]> = new Map();
	for (const source_tree_meta of metas) {
		for (const source_meta_builds of source_tree_meta.builds_by_build_name.values()) {
			for (const source_meta_build of source_meta_builds) {
				builds.push(source_meta_build);
				let source_meta_builds = builds_by_build_name.get(source_meta_build.build_name);
				if (source_meta_builds === undefined) {
					builds_by_build_name.set(source_meta_build.build_name, (source_meta_builds = []));
				}
				source_meta_builds.push(source_meta_build);
			}
		}
	}
	const build_names = Array.from(builds_by_build_name.keys()).sort();
	const build_names_from_configs = build_configs.map((b) => b.name).sort();
	if (!deep_equal(build_names, build_names_from_configs)) {
		console.warn(
			'build names differ between builds and configs',
			build_names,
			build_names_from_configs,
		);
	}
	const metas_by_build_name: Map<string, SourceTreeMeta[]> = new Map(
		build_names.map((build_name) => [
			build_name,
			metas.filter((meta) => meta.builds_by_build_name.has(build_name)),
		]),
	);
	return {
		metas,
		metas_by_build_name,
		builds_by_build_name,
		build_configs,
		build_names,
		builds,
	};
};

export const to_source_tree_meta = (metas: SourceMeta[]): SourceTreeMeta[] => {
	return metas.map((source_meta) => {
		const builds_by_build_name: Map<string, SourceMetaBuild[]> = new Map();
		for (const build of source_meta.data.builds) {
			let builds = builds_by_build_name.get(build.build_name);
			if (builds === undefined) {
				builds_by_build_name.set(build.build_name, (builds = []));
			}
			builds.push(build);
		}
		const tree_meta: SourceTreeMeta = {
			...source_meta,
			builds_by_build_name,
			build_names: Array.from(builds_by_build_name.keys()).sort(),
		};
		return tree_meta;
	});
};

// filters those meta items that have some selected build, based on `selected_build_names`
export const filter_selected_metas = (
	source_tree: SourceTree,
	selected_build_names: string[],
): SourceTreeMeta[] =>
	source_tree.metas.filter((m) => selected_build_names.some((n) => m.builds_by_build_name.has(n)));

export const get_metas_by_build_name = (
	source_tree: SourceTree,
	build_name: BuildName,
): SourceTreeMeta[] => {
	const metas = source_tree.metas_by_build_name.get(build_name)!;
	if (!metas) throw Error(`Expected to find meta:s ${build_name}`);
	return metas;
};

export const get_builds_by_build_name = (
	source_meta: SourceTreeMeta,
	build_name: BuildName,
): SourceMetaBuild[] => {
	const builds = source_meta.builds_by_build_name.get(build_name)!;
	if (!builds) throw Error(`Expected to find builds: ${build_name}`);
	return builds;
};
