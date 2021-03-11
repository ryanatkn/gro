import {SourceMeta, SourceMetaBuild} from '../build/sourceMeta.js';

export interface SourceTree {
	meta: SourceTreeMeta[];
	children: SourceTreeNode[];
}

export interface SourceTreeNode {
	children?: SourceTreeNode[];
}

export const createSourceTree = (meta: SourceMeta[]): SourceTree => {
	meta.sort((a, b) => (a.data.sourceId > b.data.sourceId ? 1 : -1));
	return {meta: toSourceTreeMeta(meta), children: []};
};

export interface SourceTreeMeta extends SourceMeta {
	buildNames: string[]; // for convenience
	buildsByName: Map<string, SourceMetaBuild>;
}

export const toSourceTreeMeta = (meta: SourceMeta[]): SourceTreeMeta[] => {
	return meta.map((sourceMeta) => {
		sourceMeta.data.builds;
		const buildsByName: Map<string, SourceMetaBuild> = new Map();
		const treeMeta: SourceTreeMeta = {
			...sourceMeta,
			buildNames: Array.from(buildsByName.keys()).sort(),
			buildsByName,
		};
		return treeMeta;
	});
};
