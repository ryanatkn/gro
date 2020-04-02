import {noop} from '../utils/function.js';
import {red, yellow, gray, black, bgYellow, bgRed} from '../colors/terminal.js';

export type Log = (...args: any[]) => void;

// TODO track warnings/errors (or anything above a certain threshold)
// and report at the end of each build (and other tasks)

export type Logger = {
	error: Log;
	warn: Log;
	info: Log;
	trace: Log;
	plain: Log;
	config: LoggerConfig;
	clone(configPartial?: Partial<LoggerConfig>): Logger;
};

export interface LoggerConfig {
	level: LogLevel;
	prefixes: any[];
	suffixes: any[];
}

export enum LogLevel {
	Off,
	Error,
	Warn,
	Info,
	Trace,
}

export const logger = (
	level: LogLevel,
	prefixes: any[] = [],
	suffixes: any[] = [],
): Logger => {
	const config = {level, prefixes, suffixes};
	const log = (
		levelPrefixes: any[],
		levelSuffixes: any[] = [],
		bakedPrefixes = prefixes,
		bakedSuffixes = suffixes,
	) => (...args: any[]) => {
		console.log(
			...levelPrefixes,
			...bakedPrefixes,
			...args,
			...bakedSuffixes,
			...levelSuffixes,
		);
	};
	return {
		config,
		error:
			level >= LogLevel.Error
				? log(
						[red('➤'), black(bgRed(' 🞩 error 🞩 ')), red('\n➤')],
						['\n ', black(bgRed(' 🞩🞩 '))],
				  )
				: noop,
		warn:
			level >= LogLevel.Warn
				? log(
						[yellow('➤'), black(bgYellow(' ⚑ warning ⚑ ')), '\n' + yellow('➤')],
						['\n ', black(bgYellow(' ⚑ '))],
				  )
				: noop,
		info: level >= LogLevel.Info ? log([gray('➤')]) : noop,
		trace: level >= LogLevel.Trace ? log([gray('-')]) : noop,
		plain: level >= LogLevel.Trace ? log([], [], [], []) : noop,
		clone(configPartial?: Partial<LoggerConfig>): Logger {
			const cfg: LoggerConfig = {...config, ...configPartial};
			return logger(cfg.level, cfg.prefixes, cfg.suffixes);
		},
	};
};

// TODO make this log.newLine. and make logger a class. and make console.log a param
export const logNewline = () => console.log('\n');
