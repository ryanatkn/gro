import type {Filesystem} from '../fs/filesystem.js';
import type {Path_Stats} from '../fs/path_data.js';
import type {Encoding} from '../fs/encoding.js';
import {get_mime_type_by_extension} from '../fs/mime.js';
import {to_hash} from './utils.js';

// TODO rename this module? or move this code elsewhere?

export interface Base_Filer_File {
	readonly id: string;
	readonly filename: string;
	readonly dir: string;
	readonly extension: string;
	readonly encoding: Encoding;
	readonly contents: string | Buffer;
	contents_buffer: Buffer | undefined; // `undefined` and mutable for lazy loading
	contents_hash: string | undefined; // `undefined` and mutable for lazy loading
	stats: Path_Stats | undefined; // `undefined` and mutable for lazy loading
	mime_type: string | null | undefined; // `null` means unknown, `undefined` and mutable for lazy loading
}

export const get_file_mime_type = (file: Base_Filer_File): string | null =>
	file.mime_type !== undefined
		? file.mime_type
		: (file.mime_type = get_mime_type_by_extension(file.extension.substring(1)));

export const get_file_contents_buffer = (file: Base_Filer_File): Buffer =>
	file.contents_buffer !== undefined
		? file.contents_buffer
		: (file.contents_buffer = Buffer.from(file.contents));

// Path_Stats are currently lazily loaded. Should they be?
export const get_file_stats = (
	fs: Filesystem,
	file: Base_Filer_File,
): Path_Stats | Promise<Path_Stats> =>
	file.stats !== undefined
		? file.stats
		: fs.stat(file.id).then((stats) => {
				file.stats = stats;
				return stats;
		  });

export const get_file_contents_hash = (file: Base_Filer_File): string =>
	file.contents_hash !== undefined
		? file.contents_hash
		: (file.contents_hash = to_hash(get_file_contents_buffer(file)));
