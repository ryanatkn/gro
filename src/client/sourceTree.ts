import {SourceMeta, SourceMetaBuild} from '../build/sourceMeta.js';

export interface SourceTree {
	// children: SourceTreeNode[];
	meta: SourceTreeMeta[];
	metaByBuildName: Map<string, SourceTreeMeta[]>;
	buildsByBuildName: Map<string, SourceMetaBuild[]>;
	buildNames: string[]; // for convenience, same as keys of `buildsByBuildName`
}

export interface SourceTreeMeta extends SourceMeta {
	buildsByBuildName: Map<string, SourceMetaBuild[]>;
	buildNames: string[]; // for convenience, same as keys of `buildsByBuildName`
}

// export interface SourceTreeNode {
// 	children?: SourceTreeNode[];
// }

export const createSourceTree = (sourceMeta: SourceMeta[]): SourceTree => {
	const meta = toSourceTreeMeta(
		sourceMeta.sort((a, b) => (a.data.sourceId > b.data.sourceId ? 1 : -1)),
	);
	const buildsByBuildName: Map<string, SourceMetaBuild[]> = new Map();
	for (const sourceTreeMeta of meta) {
		for (const sourceMetaBuilds of sourceTreeMeta.buildsByBuildName.values()) {
			for (const sourceMetaBuild of sourceMetaBuilds) {
				let builds = buildsByBuildName.get(sourceMetaBuild.name);
				if (builds === undefined) {
					buildsByBuildName.set(sourceMetaBuild.name, (builds = []));
				}
				builds.push(sourceMetaBuild);
			}
		}
	}
	const buildNames = Array.from(buildsByBuildName.keys()).sort();
	const metaByBuildName: Map<string, SourceTreeMeta[]> = new Map(
		buildNames.map((buildName) => [
			buildName,
			meta.filter((sourceTreeMeta) => sourceTreeMeta.buildsByBuildName.has(buildName)),
		]),
	);
	return {
		meta,
		metaByBuildName,
		buildsByBuildName,
		buildNames,
	};
};

export const toSourceTreeMeta = (meta: SourceMeta[]): SourceTreeMeta[] => {
	return meta.map((sourceMeta) => {
		sourceMeta.data.builds;
		const buildsByBuildName: Map<string, SourceMetaBuild[]> = new Map();
		for (const build of sourceMeta.data.builds) {
			let builds = buildsByBuildName.get(build.name);
			if (builds === undefined) {
				buildsByBuildName.set(build.name, (builds = []));
			}
			builds.push(build);
		}
		const treeMeta: SourceTreeMeta = {
			...sourceMeta,
			buildsByBuildName,
			buildNames: Array.from(buildsByBuildName.keys()).sort(),
		};
		return treeMeta;
	});
};

// filters those meta items that have some selected build, based on `selectedBuildNames`
export const filterSelectedMetaItems = (sourceTree: SourceTree, selectedBuildNames: string[]) =>
	sourceTree.meta.filter((m) => selectedBuildNames.some((n) => m.buildsByBuildName.has(n)));
