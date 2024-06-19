import {fileURLToPath} from 'node:url';
import type {Flavored} from '@ryanatkn/belt/types.js';

export type Path_Id = Flavored<string, 'Path_Id'>;

// TODO ideally none of this exists

export interface Path_Data {
	id: Path_Id;
	is_directory: boolean;
}

export const to_path_data = (id: Path_Id, stats: Path_Stats): Path_Data => ({
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

export const to_file_path = (path_or_url: string | URL): string =>
	typeof path_or_url === 'string' ? path_or_url : fileURLToPath(path_or_url.href);
