import mime from 'mime/lite.js';
import fs from 'fs-extra';

export interface File {
	readonly path: string;
	data: Buffer;
	stats: fs.Stats;
	mimeType?: string; // gets cached via `getMimeType`
}

export const loadFile = async (path: string): Promise<File | null> => {
	let stats: fs.Stats;
	try {
		stats = await fs.stat(path);
	} catch (err) {
		return null;
	}
	let data: Buffer;
	try {
		data = await fs.readFile(path); // unlikely to error after stat, but just in case
	} catch (err) {
		return null;
	}
	return {path, data, stats};
};

export const getMimeType = (file: File): string =>
	file.mimeType || (file.mimeType = toMimeType(file.path));

export const toMimeType = (path: string): string =>
	mime.getType(path) || 'text/plain';
