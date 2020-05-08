import {red} from '../colors/terminal.js';
import {SystemLogger} from './log.js';
import {printError} from './print.js';

export const attachProcessErrorHandlers = () => {
	process
		.on('uncaughtException', handleError)
		.on('unhandledRejection', handleUnhandledRejection);
};

export const handleError = (err: Error, label = 'handleError'): void => {
	const log = new SystemLogger([red(`[${label}]`)]);
	log.error(printError(err));
	process.exit(1);
};

export const handleUnhandledRejection = (err: Error | any): void => {
	if (err instanceof Error) {
		handleError(err, 'unhandledRejection');
	} else {
		handleError(new Error(err), 'unhandledRejection');
	}
};
