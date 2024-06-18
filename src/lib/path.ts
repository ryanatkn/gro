import {fileURLToPath} from 'node:url';

export const to_file_path = (path_or_url: string | URL): string =>
	typeof path_or_url === 'string' ? path_or_url : fileURLToPath(path_or_url.href);

// TODO ideally none of this exists

export interface Path_Data {
	id: string; // TODO BLOCK type `Source_Id`? (renamed to `Path_Id`?)
	is_directory: boolean;
}

export const to_path_data = (id: string, stats: Path_Stats): Path_Data => ({
	id,
	is_directory: stats.isDirectory(),
});

/**
 * Subset of `fs.Stats`.
 */
export interface Path_Stats {
	isDirectory: () => boolean;
}

export interface Path_Filter {
	(path: string, stats: Path_Stats): boolean;
}
