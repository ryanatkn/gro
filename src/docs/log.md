# log

For now, [Gro's logger](/src/utils/log.ts) is designed for development only, not production.

```ts
import {Logger} from '@feltcoop/gro';
const log = new Logger('[official business]');
log.info('i have something to report');
log.trace('this is a verbose and very wordy long report for a meeting');
log.warn('dont u dare');
log.error('wat');
log.plain('this message passes through to console.log unmodified');
```

To configure the log level, which controls log output verbosity,
Gro's default config uses the environment variable `GRO_LOG_LEVEL` if it exists,
and defaults to `LogLeve.Trace`, the most verbose option.

Users can [configure the `log_level`](./config.md) in `src/gro.config.ts`.
See [`src/config/gro.config.default.ts`](/src/config/gro.config.default.ts)
for the default.

[Gro's dev loggers](/src/utils/log.ts) have more overhead and complexity than needed
because they late-bind all of their functionality,
enabling code to globally configure logging behavior dynamically at runtime.

> This is great for development, but we need a more efficient logger for production,
> and we'll want to do perf-related buildtime log statement mapping for production anyway;
> the logger will be a small piece of that effort.

Specifically, runtime configuration is achieved by
importing the classes `Logger` and `System_Logger`
and mutating their static properties:

```ts
import {Logger, Log_Level} from '@feltcoop/gro';
Logger.level = Log_Level.Info;
```

The `configureLog_Level` helper does this for both `Logger` and `System_Logger`:

```ts
import {configureLog_Level, Log_Level} from '@feltcoop/gro';
configureLog_Level(Log_Level.Info);
// configureLog_Level = (
// 	level: Log_Level,
// 	configureMainLogger = true,
// 	configureSystem_Logger = true,
// ): void => {
```

The `print_log_label` is a helper for readability and aesthetics:

```ts
import {Logger, print_log_label} from '@feltcoop/gro';
import {rainbow} from '@feltcoop/felt/util/terminal.js';
const logA = new Logger(print_log_label('official business', rainbow));
const logB = new Logger(print_log_label('party invitations')); // default color is `magenta`
```

```ts
export class Logger extends DevLogger {
	// default logger for user code

	// see the implementation for more: /src/utils/log.ts
	// defaults to `process.env.GRO_LOG_LEVEL`
	static level: Log_Level = DEFAULT_LOG_LEVEL;
}
export class System_Logger extends DevLogger {
	// default logger for gro internal code
}

export enum Log_Level {
	Off = 0,
	Error = 1,
	Warn = 2,
	Info = 3,
	Trace = 4,
}
```

The `DevLogger` can be extended with your own custom loggers
that have state separate from the builtins.
Your loggers don't have to follow Gro's global configuration pattern, either.

> TODO production logging
