import {SourceMeta, SourceMetaBuild} from '../build/sourceMeta.js';

export interface SourceTree {
	// children: SourceTreeNode[];
	meta: SourceTreeMeta[];
	metaByBuildName: Map<string, SourceTreeMeta[]>;
	// TODO naming convention is off with `buildsByName`
	buildsByName: Map<string, SourceMetaBuild[]>;
	buildNames: string[]; // for convenience, same as keys of `buildsByName`
}

// export interface SourceTreeNode {
// 	children?: SourceTreeNode[];
// }

export const createSourceTree = (sourceMeta: SourceMeta[]): SourceTree => {
	const meta = toSourceTreeMeta(
		sourceMeta.sort((a, b) => (a.data.sourceId > b.data.sourceId ? 1 : -1)),
	);
	const buildsByName: Map<string, SourceMetaBuild[]> = new Map();
	for (const sourceTreeMeta of meta) {
		for (const sourceMetaBuilds of sourceTreeMeta.buildsByName.values()) {
			for (const sourceMetaBuild of sourceMetaBuilds) {
				let builds = buildsByName.get(sourceMetaBuild.name);
				if (builds === undefined) {
					buildsByName.set(sourceMetaBuild.name, (builds = []));
				}
				builds.push(sourceMetaBuild);
			}
		}
	}
	const buildNames = Array.from(buildsByName.keys()).sort();
	const metaByBuildName: Map<string, SourceTreeMeta[]> = new Map(
		buildNames.map((buildName) => [
			buildName,
			meta.filter((sourceTreeMeta) => sourceTreeMeta.buildsByName.has(buildName)),
		]),
	);
	return {
		meta,
		metaByBuildName,
		buildsByName,
		buildNames,
	};
};

export interface SourceTreeMeta extends SourceMeta {
	buildsByName: Map<string, SourceMetaBuild[]>;
	buildNames: string[]; // for convenience, same as keys of `buildsByName`
}

export const toSourceTreeMeta = (meta: SourceMeta[]): SourceTreeMeta[] => {
	return meta.map((sourceMeta) => {
		sourceMeta.data.builds;
		const buildsByName: Map<string, SourceMetaBuild[]> = new Map();
		for (const build of sourceMeta.data.builds) {
			let builds = buildsByName.get(build.name);
			if (builds === undefined) {
				buildsByName.set(build.name, (builds = []));
			}
			builds.push(build);
		}
		const treeMeta: SourceTreeMeta = {
			...sourceMeta,
			buildsByName,
			buildNames: Array.from(buildsByName.keys()).sort(),
		};
		return treeMeta;
	});
};

// filters those meta items that have some selected build, based on `selectedBuildNames`
export const filterSelectedMetaItems = (sourceTree: SourceTree, selectedBuildNames: string[]) =>
	sourceTree.meta.filter((m) => selectedBuildNames.some((n) => m.buildsByName.has(n)));
