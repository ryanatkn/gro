import {red, yellow, gray, black, bgYellow, bgRed, white} from 'kleur';

import {noop} from '../utils/functionUtils';
import {round} from '../utils/mathUtils';

export type Log = (...args: any[]) => void;

// TODO track warnings/errors (or anything above a certain threshold)
// and report at the end of each build (and other tasks)

export type Logger = {
	trace: Log;
	info: Log;
	warn: Log;
	error: Log;
	config: LoggerConfig;
	clone(configPartial?: Partial<LoggerConfig>): Logger;
};

export interface LoggerConfig {
	level: LogLevel;
	prefixes: any[];
	suffixes: any[];
}

export enum LogLevel {
	Trace,
	Info,
	Warn,
	Error,
}

export const logger = (
	level: LogLevel,
	prefixes: any[] = [],
	suffixes: any[] = [],
): Logger => {
	const config = {level, prefixes, suffixes};
	const log = (levelPrefixes: any[], levelSuffixes: any[] = []) => (
		...args: any[]
	) => {
		console.log(
			...levelPrefixes,
			...prefixes,
			...args,
			...suffixes,
			...levelSuffixes,
		);
	};
	return {
		config,
		trace: LogLevel.Trace >= level ? log([gray('-')]) : noop,
		info: LogLevel.Info >= level ? log([gray('➤')]) : noop,
		warn:
			LogLevel.Warn >= level
				? log(
						[yellow('➤'), black(bgYellow(' ⚑ warning ⚑ ')), '\n' + yellow('➤')],
						['\n ', black(bgYellow(' ⚑ '))],
				  )
				: noop,
		error:
			LogLevel.Error >= level
				? log(
						[red('➤'), black(bgRed(' ✖✖ error ✖✖ ')), red('➤')],
						['\n ', black(bgRed(' ✖✖✖ '))],
				  )
				: noop,
		clone(configPartial?: Partial<LoggerConfig>): Logger {
			const cfg: LoggerConfig = {...config, ...configPartial};
			return logger(cfg.level, cfg.prefixes, cfg.suffixes);
		},
	};
};

export const fmtVal = (key: string, val: string | number): string =>
	gray(`${key}(`) + val + gray(')');

export const fmtMs = (ms: number, decimals = 1): string => {
	return white(round(ms, decimals).toFixed(decimals)) + gray('ms');
};

export const fmtCauses = (solutions: string[]): string => {
	return '\n	Possible causes:' + solutions.map(s => `\n		• ${s}`).join('');
};
