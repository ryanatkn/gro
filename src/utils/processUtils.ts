import {red, yellow} from 'kleur';

import {logger, LogLevel} from './logUtils';
import {truncate} from './stringUtils';

export const attachProcessErrorHandlers = () => {
	process
		.on('uncaughtException', handleError)
		.on('unhandledRejection', handleUnhandledRejection);
};

const MAX_SCRIPT_ERROR_LOG_LENGTH = 1000;

export const handleError = (err: Error, label = 'handleError'): void => {
	const {error} = logger(LogLevel.Error, [red(`[${label}]`)]);
	const msg = err.stack ? yellow(err.stack) : yellow(`Error: ${err.message}`);
	const truncated = truncate(msg, MAX_SCRIPT_ERROR_LOG_LENGTH);
	error(truncated);
	process.exit(1);
};

export const handleUnhandledRejection = (err: Error | any): void => {
	if (err instanceof Error) {
		handleError(err, 'unhandledRejection');
	} else {
		handleError(new Error(err), 'unhandledRejection');
	}
};
