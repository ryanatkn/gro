import {deepEqual} from '@feltcoop/felt/util/equal.js';

import type {Source_Meta, Source_MetaBuild} from '../build/source_meta.js';
import type {Build_Config, Build_Name} from '../build/build_config.js';

export interface Source_Tree {
	// readonly children: Source_TreeNode[];
	readonly metas: Source_Tree_Meta[];
	readonly metas_by_build_name: Map<string, Source_Tree_Meta[]>;
	readonly builds_by_build_name: Map<string, Source_MetaBuild[]>;
	readonly build_configs: readonly Build_Config[];
	readonly build_names: string[]; // for convenience, same as keys of `builds_by_build_name`
	readonly builds: Source_MetaBuild[];
}

export interface Source_Tree_Meta extends Source_Meta {
	readonly builds_by_build_name: Map<string, Source_MetaBuild[]>;
	readonly build_names: string[]; // for convenience, same as keys of `builds_by_build_name`
}

// export interface Source_TreeNode {
// 	children?: Source_TreeNode[];
// }

export const create_source_tree = (
	source_meta: Source_Meta[],
	build_configs: readonly Build_Config[],
): Source_Tree => {
	const metas = to_source_tree_meta(
		source_meta.sort((a, b) => (a.data.source_id > b.data.source_id ? 1 : -1)),
	);
	const builds: Source_MetaBuild[] = [];
	const builds_by_build_name: Map<string, Source_MetaBuild[]> = new Map();
	for (const source_tree_meta of metas) {
		for (const source_meta_builds of source_tree_meta.builds_by_build_name.values()) {
			for (const source_metaBuild of source_meta_builds) {
				builds.push(source_metaBuild);
				let source_meta_builds = builds_by_build_name.get(source_metaBuild.name);
				if (source_meta_builds === undefined) {
					builds_by_build_name.set(source_metaBuild.name, (source_meta_builds = []));
				}
				source_meta_builds.push(source_metaBuild);
			}
		}
	}
	const build_names = Array.from(builds_by_build_name.keys()).sort();
	const build_names_from_configs = build_configs.map((b) => b.name).sort();
	if (!deepEqual(build_names, build_names_from_configs)) {
		console.warn(
			'build names differ between builds and configs',
			build_names,
			build_names_from_configs,
		);
	}
	const metas_by_build_name: Map<string, Source_Tree_Meta[]> = new Map(
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

export const to_source_tree_meta = (metas: Source_Meta[]): Source_Tree_Meta[] => {
	return metas.map((source_meta) => {
		const builds_by_build_name: Map<string, Source_MetaBuild[]> = new Map();
		for (const build of source_meta.data.builds) {
			let builds = builds_by_build_name.get(build.name);
			if (builds === undefined) {
				builds_by_build_name.set(build.name, (builds = []));
			}
			builds.push(build);
		}
		const tree_meta: Source_Tree_Meta = {
			...source_meta,
			builds_by_build_name,
			build_names: Array.from(builds_by_build_name.keys()).sort(),
		};
		return tree_meta;
	});
};

// filters those meta items that have some selected build, based on `selected_build_names`
export const filter_selected_metas = (
	source_tree: Source_Tree,
	selected_build_names: string[],
): Source_Tree_Meta[] =>
	source_tree.metas.filter((m) => selected_build_names.some((n) => m.builds_by_build_name.has(n)));

export const get_metas_by_build_name = (
	source_tree: Source_Tree,
	build_name: Build_Name,
): Source_Tree_Meta[] => {
	const metas = source_tree.metas_by_build_name.get(build_name)!;
	if (!metas) throw Error(`Expected to find meta:s ${build_name}`);
	return metas;
};

export const get_builds_by_build_name = (
	source_meta: Source_Tree_Meta,
	build_name: Build_Name,
): Source_MetaBuild[] => {
	const builds = source_meta.builds_by_build_name.get(build_name)!;
	if (!builds) throw Error(`Expected to find builds: ${build_name}`);
	return builds;
};
