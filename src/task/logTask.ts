import {cyan, gray, green} from 'kleur/colors';
import {Logger} from '@feltcoop/felt/util/log.js';
import {plural} from '@feltcoop/felt/util/string.js';
import {printValue} from '@feltcoop/felt/util/print.js';

import {type ArgSchema, type ArgsSchema} from './task.js';
import {loadModules} from '../fs/modules.js';
import {loadTaskModule, type TaskModuleMeta} from './taskModule.js';

export const logAvailableTasks = async (
	log: Logger,
	dirLabel: string,
	sourceIdsByInputPath: Map<string, string[]>,
	printIntro = true,
): Promise<void> => {
	const sourceIds = Array.from(sourceIdsByInputPath.values()).flat();
	if (sourceIds.length) {
		// Load all of the tasks so we can print their summary, and args for the `--help` flag.
		const loadModulesResult = await loadModules(sourceIdsByInputPath, true, loadTaskModule);
		if (!loadModulesResult.ok) {
			logErrorReasons(log, loadModulesResult.reasons);
			process.exit(1);
		}
		const printed: string[] = [
			`${printIntro ? '\n\n' : ''}${sourceIds.length} task${plural(
				sourceIds.length,
			)} in ${dirLabel}:\n`,
		];
		if (printIntro) {
			printed.unshift(
				`\n\n${gray('Run a task:')} gro [name]`,
				`\n${gray('View help:')}  gro [name] --help`,
			);
		}
		const longestTaskName = toMaxLength(loadModulesResult.modules, (m) => m.name);
		for (const meta of loadModulesResult.modules) {
			printed.push('\n' + cyan(pad(meta.name, longestTaskName)), '  ', meta.mod.task.summary || '');
		}
		log[printIntro ? 'info' : 'plain'](printed.join('') + '\n');
	} else {
		log.info(`No tasks found in ${dirLabel}.`);
	}
};

export const logErrorReasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(reason);
	}
};

const ARGS_PROPERTY_NAME = '[...args]';

// TODO format output in a table
export const logTaskHelp = (log: Logger, meta: TaskModuleMeta): void => {
	const {
		name,
		mod: {task},
	} = meta;
	const printed: string[] = [];
	printed.push(cyan(name), 'help', '\n' + task.summary || '(no summary available)');
	if (task.args) {
		const properties = toArgProperties(task.args);
		const longestTaskName = Math.max(
			ARGS_PROPERTY_NAME.length,
			toMaxLength(properties, (p) => p.name),
		);
		const longestType = toMaxLength(properties, (p) => p.schema.type);
		const longestDefault = toMaxLength(properties, (p) => printValue(p.schema.default));
		for (const property of properties) {
			const name = property.name === '_' ? ARGS_PROPERTY_NAME : property.name;
			printed.push(
				`\n${green(pad(name, longestTaskName))} `,
				gray(pad(property.schema.type, longestType)) + ' ',
				pad(printValue(property.schema.default), longestDefault) + ' ',
				property.schema.description || '(no description available)',
			);
		}
	}
	log.info(...printed);
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

// quick n dirty padding logic
const pad = (s: string, n: number): string =>
	s.length ? s + ' '.repeat(n - s.length) : ' '.repeat(n);

const toMaxLength = <T>(items: T[], toString: (item: T) => string) =>
	items.reduce((max, m) => Math.max(toString(m).length, max), 0);
