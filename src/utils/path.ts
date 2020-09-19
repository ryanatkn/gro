import {extname, basename} from 'path';

export const replaceExtension = (path: string, newExtension: string): string => {
	const extension = extname(path);
	return extension.length ? path.slice(0, -extension.length) + newExtension : path + newExtension;
};

export const hasExtension = (path: string, extensions: string[]): boolean =>
	extensions.some((e) => extname(path) === e);

export const getPathStem = (path: string): string => replaceExtension(basename(path), '');
