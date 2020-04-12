import {blue, magenta, red, green, gray} from '../colors/terminal.js';
import {gen} from '../gen/gen.js';
import {createNodeGenHost} from '../gen/nodeGenHost.js';
import {logger, LogLevel} from '../utils/log.js';
import {paths} from '../paths.js';
import {fmtPath, fmtMs} from '../utils/fmt.js';

// TODO get LogLevel from env vars and cli args - make it an option
const logLevel = LogLevel.Trace;

const log = logger(logLevel, [blue(`[commands/${magenta('gen')}]`)]);
const {info} = log;

export interface Options {}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {results, count, elapsed} = await gen({
		host: createNodeGenHost({
			logLevel: log.config.level,
		}),
		dir: paths.source,
	});

	// TODO what's a better way to log this output? is not a consistent table
	let logResult = `generated ${count} files in ${fmtMs(elapsed)}`;
	for (const result of results) {
		logResult += `\n\t\t${result.ok ? green('✓') : red('🞩')}  ${
			result.ok ? result.count : 0
		} ${gray('in')} ${fmtMs(result.elapsed)} ${gray('←')} ${fmtPath(
			result.id,
		)}`;
	}
	info(logResult);
};
