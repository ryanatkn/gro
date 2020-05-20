import {extname, basename} from 'path';

export const replaceExt = (path: string, ext: string): string => {
	const extension = extname(path);
	return extension.length ? path.slice(0, -extension.length) + ext : path + ext;
};

export const hasExt = (path: string, exts: string[]): boolean =>
	exts.some((ext) => extname(path) === ext);

export const getPathStem = (path: string): string => replaceExt(basename(path), '');
