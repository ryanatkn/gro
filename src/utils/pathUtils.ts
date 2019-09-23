import fs from 'fs-extra';
import * as fp from 'path';
const {resolve, extname, basename, sep} = fp; // TODO esm

export const cwd = fs.realpathSync(process.cwd()) + sep;

export const resolvePath = (relativePath: string): string =>
	resolve(cwd, relativePath);

export const replaceExt = (path: string, ext: string): string => {
	const extension = extname(path);
	return extension.length ? path.slice(0, -extension.length) + ext : path + ext;
};

export const hasExt = (path: string, exts: string[]): boolean =>
	exts.some(ext => extname(path) === ext);

export const getPathStem = (path: string): string =>
	replaceExt(basename(path), '');
