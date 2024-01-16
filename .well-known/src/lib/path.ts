import {fileURLToPath} from 'node:url';

export const to_file_path = (path_or_url: string | URL): string =>
	typeof path_or_url === 'string' ? path_or_url : fileURLToPath(path_or_url.href);

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
