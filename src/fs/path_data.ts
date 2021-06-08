export interface Path_Data {
	id: string; // absolute path, same as `id` in rollup
	is_directory: boolean;
}

export const toPath_Data = (id: string, stats: Path_Stats): Path_Data => {
	return {
		id,
		is_directory: stats.isDirectory(),
	};
};

// This is a browser-compatible subset of `fs.Stats`.
// TODO the `size` ? should we always support it?
export interface Path_Stats {
	size?: number;
	isDirectory(): boolean;
}
