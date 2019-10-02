import {round} from '../utils/math.js';
import {gray, white, green} from '../colors/terminal.js';
import {toRootPath} from '../paths.js';

export const fmtVal = (key: string, val: string | number): string =>
	gray(`${key}(`) + val + gray(')');

export const fmtMs = (ms: number, decimals = 1): string =>
	white(round(ms, decimals).toFixed(decimals)) + gray('ms');
export const fmtCauses = (solutions: string[]): string =>
	'\n	Possible causes:' + solutions.map(s => `\n		• ${s}`).join('');
export const fmtStr = (s: string): string => green(`'${s}'`);

export const fmtValue = (value: unknown): unknown => {
	switch (typeof value) {
		case 'string':
			return fmtStr(value);
		default:
			return value;
	}
};

export const fmtPath = (p: string): string => gray(toRootPath(p));
