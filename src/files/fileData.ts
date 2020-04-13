export interface FileData {
	id: string; // absolute path, same as `id` in rollup
	stats: FileStats;
}

// This is a browser-compatible subset of `fs.Stats`.
export interface FileStats {
	isDirectory(): boolean;
}

export const toFileData = (id: string, stats: FileStats): FileData => {
	return {
		id,
		stats,
	};
};
