import * as kleur from 'kleur';
import {realpathSync} from 'fs';
import {resolve, extname, basename} from 'path';

import {round} from '../utils/math';

const colors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const;
export const rainbow = (str: string): string =>
	str
		.split('')
		.map((char, i) => kleur[colors[i % colors.length]](char))
		.join('');

export const cwd = realpathSync(process.cwd());
export const resolvePath = (relativePath: string): string =>
	resolve(cwd, relativePath);

export const replaceExt = (path: string, ext: string): string =>
	path.slice(0, -extname(path).length) + ext;

export const hasExt = (path: string, exts: string[]): boolean =>
	exts.some(ext => extname(path) === ext);

export const extractFilename = (path: string): string =>
	replaceExt(basename(path), '');

export const timeTracker = (decimals = 2) => {
	let start = process.hrtime.bigint();
	return (reset = true): number => {
		const end = process.hrtime.bigint();
		const elapsed = round(Number(end - start) / 1000000, decimals);
		if (reset) start = process.hrtime.bigint();
		return elapsed;
	};
};
