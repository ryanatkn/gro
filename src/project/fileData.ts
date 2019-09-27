export interface FileData {
	id: string; // absolute path, same as `id` in rollup
	stats: FileStats;
}

export interface FileStats {
	isDirectory(): boolean;
}

export const toFileData = (id: string, stats: FileStats): FileData => {
	return {
		id,
		stats,
	};
};
