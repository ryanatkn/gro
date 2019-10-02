import {noop} from '../utils/function.js';
import {red, yellow, gray, black, bgYellow, bgRed} from '../colors/terminal.js';

export type Log = (...args: any[]) => void;

// TODO track warnings/errors (or anything above a certain threshold)
// and report at the end of each build (and other tasks)

export type Logger = {
	trace: Log;
	info: Log;
	warn: Log;
	error: Log;
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
						[red('➤'), black(bgRed(' 🞩 error 🞩 ')), red('\n➤')],
						['\n ', black(bgRed(' 🞩🞩 '))],
				  )
				: noop,
		plain: log([], [], [], []),
		clone(configPartial?: Partial<LoggerConfig>): Logger {
			const cfg: LoggerConfig = {...config, ...configPartial};
			return logger(cfg.level, cfg.prefixes, cfg.suffixes);
		},
	};
};

export const logNewline = () => console.log('\n');
