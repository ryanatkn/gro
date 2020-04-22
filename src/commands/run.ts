import {blue, magenta} from '../colors/terminal.js';
import {run as runTasks} from '../run/run.js';
import {SystemLogger} from '../utils/log.js';
import {Args} from '../bin/types.js';
import {paths} from '../paths.js';
import {createNodeRunHost} from '../run/nodeRunHost.js';

const log = new SystemLogger([blue(`[commands/${magenta('run')}]`)]);
const {info} = log;

// Options are done differently here than normal to accept arbitrary CLI flags.
// We still export a consistent external interface
// even though `InitialOptions` and `initOptions` are no-ops.
export type Options = Args;
export type InitialOptions = Options;
export const initOptions = (opts: InitialOptions): Options => opts;

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {
		_: [taskName, ..._],
		...namedArgs
	} = options;
	const args = {_, ...namedArgs};

	await runTasks({
		host: createNodeRunHost(),
		dir: paths.source, // TODO customize
		taskName,
		args,
	});
};
