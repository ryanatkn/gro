import {fileURLToPath, type URL} from 'node:url';
import type {Flavored} from '@ryanatkn/belt/types.js';

// TODO BLOCK move to belt

/**
 * An absolute path on the filesystem. Named "id" to be consistent with Rollup.
 */
export type Path_Id = Flavored<string, 'Path_Id'>;

export interface Path_Info {
	id: Path_Id;
	is_directory: boolean;
}

export interface Resolved_Path extends Path_Info {
	path: string;
}

export type Path_Filter = (path: string, is_directory: boolean) => boolean;

export type File_Filter = (path: string) => boolean;

export const to_file_path = (path_or_url: string | URL): string =>
	typeof path_or_url === 'string' ? path_or_url : fileURLToPath(path_or_url.href);
