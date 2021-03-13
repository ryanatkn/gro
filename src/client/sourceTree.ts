import {SourceMeta, SourceMetaBuild} from '../build/sourceMeta.js';
import {BuildConfig} from '../config/buildConfig.js';
import {deepEqual} from '../utils/deepEqual.js';

export interface SourceTree {
	// readonly children: SourceTreeNode[];
	readonly meta: SourceTreeMeta[];
	readonly metaByBuildName: Map<string, SourceTreeMeta[]>;
	readonly buildsByBuildName: Map<string, SourceMetaBuild[]>;
	readonly buildConfigs: readonly BuildConfig[];
	readonly buildNames: string[]; // for convenience, same as keys of `buildsByBuildName`
	readonly builds: SourceMetaBuild[];
}

export interface SourceTreeMeta extends SourceMeta {
	readonly buildsByBuildName: Map<string, SourceMetaBuild[]>;
	readonly buildNames: string[]; // for convenience, same as keys of `buildsByBuildName`
}

// export interface SourceTreeNode {
// 	children?: SourceTreeNode[];
// }

export const createSourceTree = (
	sourceMeta: SourceMeta[],
	buildConfigs: readonly BuildConfig[],
): SourceTree => {
	const meta = toSourceTreeMeta(
		sourceMeta.sort((a, b) => (a.data.sourceId > b.data.sourceId ? 1 : -1)),
	);
	const builds: SourceMetaBuild[] = [];
	const buildsByBuildName: Map<string, SourceMetaBuild[]> = new Map();
	for (const sourceTreeMeta of meta) {
		for (const sourceMetaBuilds of sourceTreeMeta.buildsByBuildName.values()) {
			for (const sourceMetaBuild of sourceMetaBuilds) {
				builds.push(sourceMetaBuild);
				let sourceMetaBuilds = buildsByBuildName.get(sourceMetaBuild.name);
				if (sourceMetaBuilds === undefined) {
					buildsByBuildName.set(sourceMetaBuild.name, (sourceMetaBuilds = []));
				}
				sourceMetaBuilds.push(sourceMetaBuild);
			}
		}
	}
	const buildNames = Array.from(buildsByBuildName.keys()).sort();
	const buildNamesFromConfigs = buildConfigs.map((b) => b.name).sort();
	if (!deepEqual(buildNames, buildNamesFromConfigs)) {
		console.warn(
			'build names differ between builds and configs',
			buildNames,
			buildNamesFromConfigs,
		);
	}
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
		buildConfigs,
		buildNames,
		builds,
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

export const getMetaByBuildName = (sourceTree: SourceTree, buildName: string): SourceTreeMeta[] => {
	const meta = sourceTree.metaByBuildName.get(buildName)!;
	if (!meta) throw Error(`Expected to find meta: ${buildName}`);
	return meta;
};

export const getBuildsByBuildName = (
	sourceMeta: SourceTreeMeta,
	buildName: string,
): SourceMetaBuild[] => {
	const builds = sourceMeta.buildsByBuildName.get(buildName)!;
	if (!builds) throw Error(`Expected to find builds: ${buildName}`);
	return builds;
};
