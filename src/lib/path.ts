import {fileURLToPath} from 'node:url';
import type {Flavored} from '@ryanatkn/belt/types.js';

export type Path_Id = Flavored<string, 'Path_Id'>;

// TODO ideally none of this exists

// TODO BLOCK maybe rename to `Path_Info`?
export interface Path_Data {
	id: Path_Id;
	is_directory: boolean;
}

export interface Path_Filter {
	(path: string, is_directory: boolean): boolean;
}

export const to_file_path = (path_or_url: string | URL): string =>
	typeof path_or_url === 'string' ? path_or_url : fileURLToPath(path_or_url.href);
