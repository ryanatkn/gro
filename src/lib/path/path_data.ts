export interface PathData {
	id: string; // absolute path, same as `id` in rollup
	isDirectory: boolean;
}

export const to_path_data = (id: string, stats: PathStats): PathData => {
	return {
		id,
		isDirectory: stats.isDirectory(),
	};
};

// subset of `fs.Stats`
export interface PathStats {
	isDirectory: () => boolean; // TODO maybe cache as `isDirectory`?
}
