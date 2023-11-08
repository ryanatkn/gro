// TODO ideally none of this exists

export interface Path_Data {
	id: string; // absolute path, same as `id` in rollup
	isDirectory: boolean;
}

export const to_path_data = (id: string, stats: Path_Stats): Path_Data => {
	return {
		id,
		isDirectory: stats.isDirectory(),
	};
};

// subset of `fs.Stats`
export interface Path_Stats {
	isDirectory: () => boolean; // TODO maybe cache as `isDirectory`?
}

export interface Path_Filter {
	(path: string, stats: Path_Stats): boolean;
}
