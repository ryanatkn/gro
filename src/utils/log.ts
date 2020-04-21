import {red, yellow, gray, black, bgYellow, bgRed} from '../colors/terminal.js';
import {EMPTY_ARRAY} from './array.js';

// TODO track warnings/errors (or anything above a certain threshold)
// and report at the end of each build (and other tasks)

export enum LogLevel {
	Off,
	Error,
	Warn,
	Info,
	Trace,
}

/*

`Logger` uses a special pattern
to achieve a good mix of convenience and flexibility
both for Gro and user code.
It uses late binding to allow runtime mutations
and it accepts a `LoggerState` argument for custom behavior.

The default `LoggerState` is the `Logger` class itself.
This pattern allows us to have globally mutable logger state
without locking the code into the singleton pattern.
Properties like the static `Logger.level` can be mutated
to affect all loggers that get instantiated with the default state,
but loggers can also be instantiated with other state
that isn't affected by these globally mutable values.

Custom loggers like `SystemLogger` (see below)
demonstrate extending `Logger` to partition logging concerns.
User code is given a lot of control and flexibility.

This design opens the potential for hard-to-track bugs -
globally mutable properties bad!! -
but it also provides flexibility that feels appropriate for logging.
This probably isn't a good pattern to use in, for example,
the data management layer.

Logging in and around tests is a motivating use case for this design.
See the usage of `TestLogger` in the test framework code for more.

*/
export class Logger {
	constructor(
		public readonly prefixes: readonly any[] = EMPTY_ARRAY,
		public readonly suffixes: readonly any[] = EMPTY_ARRAY,
		public readonly state: LoggerState = Logger,
	) {}

	readonly error = (...args: any[]): void => {
		if (this.state.level < LogLevel.Error) return;
		this.state.log(
			...this.state.error.prefixes,
			...this.prefixes,
			...args,
			...this.suffixes,
			...this.state.error.suffixes,
		);
	};

	readonly warn = (...args: any[]): void => {
		if (this.state.level < LogLevel.Warn) return;
		this.state.log(
			...this.state.warn.prefixes,
			...this.prefixes,
			...args,
			...this.suffixes,
			...this.state.warn.suffixes,
		);
	};

	readonly info = (...args: any[]): void => {
		if (this.state.level < LogLevel.Info) return;
		this.state.log(
			...this.state.info.prefixes,
			...this.prefixes,
			...args,
			...this.suffixes,
			...this.state.info.suffixes,
		);
	};

	readonly trace = (...args: any[]): void => {
		if (this.state.level < LogLevel.Trace) return;
		this.state.log(
			...this.state.trace.prefixes,
			...this.prefixes,
			...args,
			...this.suffixes,
			...this.state.trace.suffixes,
		);
	};

	plain(...args: any[]): void {
		this.state.log(...args);
	}

	newline(): void {
		this.state.log('\n');
	}

	// These properties can be mutated at runtime
	// to affect all loggers instantiated with the default `state`.
	// See the comment on `LoggerState` for more.
	static level = LogLevel.Trace;
	static log: Log = console.log.bind(console);
	static error: LogLevelDefaults = {
		prefixes: [red('➤'), black(bgRed(' 🞩 error 🞩 ')), red('\n➤')],
		suffixes: ['\n ', black(bgRed(' 🞩🞩 '))],
	};
	static warn: LogLevelDefaults = {
		prefixes: [
			yellow('➤'),
			black(bgYellow(' ⚑ warning ⚑ ')),
			'\n' + yellow('➤'),
		],
		suffixes: ['\n ', black(bgYellow(' ⚑ '))],
	};
	static info: LogLevelDefaults = {
		prefixes: [gray('➤')],
		suffixes: [],
	};
	static trace: LogLevelDefaults = {
		prefixes: [gray('-')],
		suffixes: [],
	};
}

export type Log = (...args: any[]) => void;

export interface LoggerState {
	level: LogLevel;
	log: Log;
	error: LogLevelDefaults;
	warn: LogLevelDefaults;
	info: LogLevelDefaults;
	trace: LogLevelDefaults;
}

interface LogLevelDefaults {
	prefixes: any[];
	suffixes: any[];
}

/*

The `SystemLogger` is distinct from the `Logger`
to cleanly separate Gro's logging from user logging.
Gro internally uses `SystemLogger`, not `Logger` directly.
This allows user code to simply import and use `Logger`.
`SystemLogger` is still made available to user code,
and users can always extend `Logger` with their own custom versions.

*/
export class SystemLogger extends Logger {
	static level = LogLevel.Trace;
	constructor(
		prefixes: readonly any[] = EMPTY_ARRAY,
		suffixes: readonly any[] = EMPTY_ARRAY,
		state: LoggerState = SystemLogger,
	) {
		super(prefixes, suffixes, state);
	}
}
