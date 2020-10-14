import {extname, basename} from 'path';

export const replaceExtension = (path: string, newExtension: string): string => {
	const {length} = extname(path);
	return (length === 0 ? path : path.substring(0, path.length - length)) + newExtension;
};

export const getPathStem = (path: string): string => replaceExtension(basename(path), '');
