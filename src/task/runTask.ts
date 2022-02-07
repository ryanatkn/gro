import {type EventEmitter} from 'events';
import {cyan, gray, green, red} from 'kleur/colors';
import {type Logger, printLogLabel, SystemLogger} from '@feltcoop/felt/util/log.js';
import {printValue} from '@feltcoop/felt/util/print.js';

import {type TaskModuleMeta} from './taskModule.js';
import {TaskError, type Args, type ArgSchema, type ArgsSchema} from './task.js';
import {type invokeTask as InvokeTaskFunction} from './invokeTask.js';
import {type Filesystem} from '../fs/filesystem.js';

export type RunTaskResult =
	| {
			ok: true;
			output: unknown;
	  }
	| {
			ok: false;
			reason: string;
			error: Error;
	  };

export const runTask = async (
	fs: Filesystem,
	taskMeta: TaskModuleMeta,
	args: Args,
	events: EventEmitter,
	invokeTask: typeof InvokeTaskFunction,
): Promise<RunTaskResult> => {
	const {task} = taskMeta.mod;
	const log = new SystemLogger(printLogLabel(taskMeta.name));
	const dev = process.env.NODE_ENV !== 'production'; // TODO should this use `fromEnv`? '$app/env'?
	if (dev && task.production) {
		throw new TaskError(`The task "${taskMeta.name}" cannot be run in development`);
	}
	if (args.help) {
		logTaskHelp(log, taskMeta);
		return {ok: true, output: null};
	}
	let output: unknown;
	try {
		output = await task.run({
			fs,
			dev,
			args,
			events,
			log,
			invokeTask: (invokedTaskName, invokedArgs = args, invokedEvents = events, invokedFs = fs) =>
				invokeTask(invokedFs, invokedTaskName, invokedArgs, invokedEvents),
		});
	} catch (err) {
		return {
			ok: false,
			reason: red(
				err instanceof TaskError
					? err.message
					: `Unexpected error running task ${cyan(
							taskMeta.name,
					  )}. If this is unexpected try running \`gro clean\`.`,
			),
			error: err,
		};
	}
	return {ok: true, output};
};

// TODO format output in a table
const logTaskHelp = (log: Logger, meta: TaskModuleMeta) => {
	const {
		name,
		mod: {task},
	} = meta;
	const strs: string[] = ['help', '\n', cyan(name), '\n', task.summary || '(no summary available)'];
	if (!task.args) {
		strs.push('\n', '(no args schema available)');
	} else {
		for (const property of toArgProperties(task.args)) {
			const name = property.name === '_' ? '[...args]' : property.name;
			strs.push(
				'\n',
				green(name),
				gray(property.schema.type),
				printValue(property.schema.default) as string,
				property.schema.description || '(no description available)',
			);
		}
	}
	log.info(...strs);
};

interface ArgSchemaProperty {
	name: string;
	schema: ArgSchema;
}

const toArgProperties = (schema: ArgsSchema): ArgSchemaProperty[] => {
	const properties: ArgSchemaProperty[] = [];
	for (const name in schema.properties) {
		if ('no-' + name in schema.properties) continue;
		properties.push({name, schema: schema.properties[name]});
	}
	return properties;
};
