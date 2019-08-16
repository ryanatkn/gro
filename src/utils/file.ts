import * as mime from 'mime/lite';
import {readFile, stat, Stats} from 'fs-extra';

export interface File {
	readonly path: string;
	data: Buffer;
	stats: Stats;
	mimeType?: string; // gets cached via `getMimeType`
}

export const loadFile = async (path: string): Promise<File | null> => {
	let stats: Stats;
	try {
		stats = await stat(path);
	} catch (err) {
		return null;
	}
	let data: Buffer;
	try {
		data = await readFile(path); // unlikely to error after stat, but just in case
	} catch (err) {
		return null;
	}
	return {path, data, stats};
};

export const getMimeType = (file: File): string =>
	file.mimeType || (file.mimeType = toMimeType(file.path));

export const toMimeType = (path: string): string =>
	mime.getType(path) || 'text/plain';
