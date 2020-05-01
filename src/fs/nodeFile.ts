import {extname} from 'path';

import {stat, readFile, Stats} from './nodeFs.js';
import {getMimeTypeByExtension} from './mime.js';

export interface File {
	readonly path: string;
	data: Buffer;
	stats: Stats;
	mimeType?: string | null; // cached by `getMimeType`, `null` means unknown
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

export const getMimeType = (file: File): string | null =>
	file.mimeType === undefined
		? (file.mimeType = getMimeTypeByExtension(extname(file.path).slice(1)))
		: file.mimeType;
