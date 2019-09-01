import {red, yellow, green, cyan, blue, magenta} from 'kleur';
import {realpathSync} from 'fs';
import {resolve, extname, basename} from 'path';

export const colors = [red, yellow, green, cyan, blue, magenta];
export const rainbow = (str: string): string =>
	str
		.split('')
		.map((char, i) => colors[i % colors.length](char))
		.join('');

export const cwd = realpathSync(process.cwd());
export const resolvePath = (relativePath: string): string =>
	resolve(cwd, relativePath);

export const replaceExt = (path: string, ext: string): string =>
	path.slice(0, -extname(path).length) + ext;

export const hasExt = (path: string, exts: string[]): boolean =>
	exts.some(ext => extname(path) === ext);

export const getPathName = (path: string): string =>
	replaceExt(basename(path), '');
