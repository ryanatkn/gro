import {deepEqual} from '@feltcoop/felt/utils/equal.js';

import type {SourceMeta, SourceMetaBuild} from '../build/source_meta.js';
import type {Build_Config, Build_Name} from '../build/build_config.js';

export interface SourceTree {
	// readonly children: SourceTreeNode[];
	readonly metas: SourceTreeMeta[];
	readonly metasByBuild_Name: Map<string, SourceTreeMeta[]>;
	readonly buildsByBuild_Name: Map<string, SourceMetaBuild[]>;
	readonly build_configs: readonly Build_Config[];
	readonly build_names: string[]; // for convenience, same as keys of `buildsByBuild_Name`
	readonly builds: SourceMetaBuild[];
}

export interface SourceTreeMeta extends SourceMeta {
	readonly buildsByBuild_Name: Map<string, SourceMetaBuild[]>;
	readonly build_names: string[]; // for convenience, same as keys of `buildsByBuild_Name`
}

// export interface SourceTreeNode {
// 	children?: SourceTreeNode[];
// }

export const createSourceTree = (
	source_meta: SourceMeta[],
	build_configs: readonly Build_Config[],
): SourceTree => {
	const metas = toSourceTreeMeta(
		source_meta.sort((a, b) => (a.data.source_id > b.data.source_id ? 1 : -1)),
	);
	const builds: SourceMetaBuild[] = [];
	const buildsByBuild_Name: Map<string, SourceMetaBuild[]> = new Map();
	for (const sourceTreeMeta of metas) {
		for (const source_metaBuilds of sourceTreeMeta.buildsByBuild_Name.values()) {
			for (const source_metaBuild of source_metaBuilds) {
				builds.push(source_metaBuild);
				let source_metaBuilds = buildsByBuild_Name.get(source_metaBuild.name);
				if (source_metaBuilds === undefined) {
					buildsByBuild_Name.set(source_metaBuild.name, (source_metaBuilds = []));
				}
				source_metaBuilds.push(source_metaBuild);
			}
		}
	}
	const build_names = Array.from(buildsByBuild_Name.keys()).sort();
	const build_namesFromConfigs = build_configs.map((b) => b.name).sort();
	if (!deepEqual(build_names, build_namesFromConfigs)) {
		console.warn(
			'build names differ between builds and configs',
			build_names,
			build_namesFromConfigs,
		);
	}
	const metasByBuild_Name: Map<string, SourceTreeMeta[]> = new Map(
		build_names.map((build_name) => [
			build_name,
			metas.filter((meta) => meta.buildsByBuild_Name.has(build_name)),
		]),
	);
	return {
		metas,
		metasByBuild_Name,
		buildsByBuild_Name,
		build_configs,
		build_names,
		builds,
	};
};

export const toSourceTreeMeta = (metas: SourceMeta[]): SourceTreeMeta[] => {
	return metas.map((source_meta) => {
		const buildsByBuild_Name: Map<string, SourceMetaBuild[]> = new Map();
		for (const build of source_meta.data.builds) {
			let builds = buildsByBuild_Name.get(build.name);
			if (builds === undefined) {
				buildsByBuild_Name.set(build.name, (builds = []));
			}
			builds.push(build);
		}
		const treeMeta: SourceTreeMeta = {
			...source_meta,
			buildsByBuild_Name,
			build_names: Array.from(buildsByBuild_Name.keys()).sort(),
		};
		return treeMeta;
	});
};

// filters those meta items that have some selected build, based on `selectedBuild_Names`
export const filterSelectedMetas = (
	sourceTree: SourceTree,
	selectedBuild_Names: string[],
): SourceTreeMeta[] =>
	sourceTree.metas.filter((m) => selectedBuild_Names.some((n) => m.buildsByBuild_Name.has(n)));

export const getMetasByBuild_Name = (
	sourceTree: SourceTree,
	build_name: Build_Name,
): SourceTreeMeta[] => {
	const metas = sourceTree.metasByBuild_Name.get(build_name)!;
	if (!metas) throw Error(`Expected to find meta:s ${build_name}`);
	return metas;
};

export const getBuildsByBuild_Name = (
	source_meta: SourceTreeMeta,
	build_name: Build_Name,
): SourceMetaBuild[] => {
	const builds = source_meta.buildsByBuild_Name.get(build_name)!;
	if (!builds) throw Error(`Expected to find builds: ${build_name}`);
	return builds;
};
