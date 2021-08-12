export interface PathData {
	id: string; // absolute path, same as `id` in rollup
	is_directory: boolean;
}

export const to_path_data = (id: string, stats: PathStats): PathData => {
	return {
		id,
		is_directory: stats.isDirectory(),
	};
};

// This is a browser-compatible subset of `fs.Stats`.
// TODO the `size` ? should we always support it?
export interface PathStats {
	size?: number;
	isDirectory(): boolean; // TODO maybe cache as `is_directory`?
}
