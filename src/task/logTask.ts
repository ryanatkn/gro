import {cyan, gray, green} from 'kleur/colors';
import {Logger} from '@feltcoop/felt/util/log.js';
import {plural} from '@feltcoop/felt/util/string.js';
import {printValue} from '@feltcoop/felt/util/print.js';

import {type Args, type ArgSchema, type ArgsSchema} from './task.js';
import {loadModules} from '../fs/modules.js';
import {loadTaskModule, type TaskModuleMeta} from './taskModule.js';

export const logAvailableTasks = async (
	log: Logger,
	dirLabel: string,
	sourceIdsByInputPath: Map<string, string[]>,
	args: Args,
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
			`\n\n${gray('Run a task:')} gro [name]`,
			`\n${gray('View help:')}  gro [name] --help`,
			`\n\n${sourceIds.length} task${plural(sourceIds.length)} in ${dirLabel}:${
				args.help ? '' : '\n'
			}`,
		];
		for (const meta of loadModulesResult.modules) {
			printed.push('\n' + cyan(meta.name), ' ', meta.mod.task.summary || '');
		}
		log.info(printed.join('') + '\n');
	} else {
		log.info(`No tasks found in ${dirLabel}.`);
	}
};

export const logErrorReasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(reason);
	}
};

// TODO format output in a table
export const printTaskHelp = (meta: TaskModuleMeta): string[] => {
	const {
		name,
		mod: {task},
	} = meta;
	const printed: string[] = [cyan(name), '\n', task.summary || '(no summary available)'];
	if (task.args) {
		for (const property of toArgProperties(task.args)) {
			const name = property.name === '_' ? '[...args]' : property.name;
			printed.push(
				'\n',
				green(name),
				' ',
				gray(property.schema.type),
				' ',
				printValue(property.schema.default) as string,
				' ',
				property.schema.description || '(no description available)',
			);
		}
	}
	return printed;
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
