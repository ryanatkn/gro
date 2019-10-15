export interface FileData {
	id: string; // absolute path, same as `id` in rollup
	stats: FileStats;
}

// TODO this is limited for browser usage, but it's not clear where the boundaries are - we're using `fs.Stats` in many places
export interface FileStats {
	isDirectory(): boolean;
}

export const toFileData = (id: string, stats: FileStats): FileData => {
	return {
		id,
		stats,
	};
};
