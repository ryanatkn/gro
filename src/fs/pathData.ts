export interface PathData {
	id: string; // absolute path, same as `id` in rollup
	isDirectory: boolean;
}

// This is a browser-compatible subset of `fs.Stats`.
export interface PathStats {
	isDirectory(): boolean;
}

export const toPathData = (id: string, stats: PathStats): PathData => {
	return {
		id,
		isDirectory: stats.isDirectory(),
	};
};

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface PathFilter {
	(file: {path: string; stats: PathStats}): boolean;
}
