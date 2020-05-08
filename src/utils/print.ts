import {round} from '../utils/math.js';
import {gray, white, green, yellow} from '../colors/terminal.js';
import {
	paths,
	toRootPath,
	groDirBasename,
	pathsFromId,
	groPaths,
} from '../paths.js';
import {truncate} from './string.js';

export const printKeyValue = (key: string, val: string | number): string =>
	gray(`${key}(`) + val + gray(')');

export const printMs = (ms: number, decimals = 1): string =>
	white(round(ms, decimals).toFixed(decimals)) + gray('ms');
export const printCauses = (solutions: string[]): string =>
	'\n	Possible causes:' + solutions.map(s => `\n		• ${s}`).join('');
export const printStr = (s: string): string => green(`'${s}'`);

export const printValue = (value: unknown): unknown => {
	switch (typeof value) {
		case 'string':
			return printStr(value);
		default:
			return value;
	}
};

export const printPath = (path: string, p = paths): string =>
	gray(toRootPath(path, p) || './');

export const printPathOrGroPath = (path: string, fromPaths = paths): string => {
	const inferredPaths = pathsFromId(path);
	if (fromPaths === groPaths || inferredPaths === fromPaths) {
		return printPath(path, inferredPaths);
	} else {
		return gray(groDirBasename) + printPath(path, groPaths);
	}
};

const MAX_ERROR_LOG_LENGTH = 1000;

// Because throwing errors and rejecting promises isn't typesafe,
// don't assume the arg is an `Error` and try to return something useful.
export const printError = (err: Error): string =>
	truncate(
		yellow(
			(err && (err.stack || (err.message && `Error: ${err.message}`))) ||
				`Unknown error: ${err}`,
		),
		MAX_ERROR_LOG_LENGTH,
	);

export const printSubTiming = (key: string | number, timing: number): string =>
	`${printMs(timing)} ${gray('←')} ${gray(key)}`;
