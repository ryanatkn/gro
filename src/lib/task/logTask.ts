import {cyan, gray, green, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import {plural} from '@feltjs/util/string.js';
import {printValue} from '@feltjs/util/print.js';
import {ZodFirstPartyTypeKind, type ZodObjectDef, type ZodTypeAny, type ZodTypeDef} from 'zod';

import type {ArgSchema} from '../task/args.js';
import {loadModules} from '../fs/modules.js';
import {load_task_module, type TaskModuleMeta} from './taskModule.js';

export const log_available_tasks = async (
	log: Logger,
	dirLabel: string,
	source_idsByInputPath: Map<string, string[]>,
	printIntro = true,
): Promise<void> => {
	const source_ids = Array.from(source_idsByInputPath.values()).flat();
	if (source_ids.length) {
		// Load all of the tasks so we can print their summary, and args for the `--help` flag.
		const loadModulesResult = await loadModules(source_idsByInputPath, true, load_task_module);
		if (!loadModulesResult.ok) {
			log_error_reasons(log, loadModulesResult.reasons);
			process.exit(1);
		}
		const printed: string[] = [
			`${printIntro ? '\n\n' : ''}${source_ids.length} task${plural(
				source_ids.length,
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

export const log_error_reasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(red(reason));
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
	printed.push(
		cyan(name),
		'help',
		cyan(`\ngro ${name}`) + `: ${task.summary || '(no summary available)'}`,
	);
	if (task.Args) {
		const properties = toArgProperties(task.Args._def, meta);
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

const toArgProperties = (def: ZodTypeDef, meta: TaskModuleMeta): ArgSchemaProperty[] => {
	const typeName = toTypeName(def);
	if (typeName !== ZodFirstPartyTypeKind.ZodObject) {
		throw Error(
			`Expected Args for task "${meta.name}" to be a ZodObject schema but got ${typeName}`,
		);
	}
	const shape = (def as ZodObjectDef).shape();
	const properties: ArgSchemaProperty[] = [];
	for (const name in shape) {
		if ('no-' + name in shape) continue;
		const s = shape[name];
		const schema: ArgSchema = {
			type: toArgsSchemaType(s),
			description: toArgsSchemaDescription(s),
			default: toArgsSchemaDefault(s),
		};
		properties.push({name, schema});
	}
	return properties;
};

// quick n dirty padding logic
const pad = (s: string, n: number): string => s + ' '.repeat(n - s.length);
const toMaxLength = <T>(items: T[], toString: (item: T) => string) =>
	items.reduce((max, m) => Math.max(toString(m).length, max), 0);

// The following Zod helpers only need to support single-depth schemas for CLI args,
// but there's generic recursion to handle things like `ZodOptional` and `ZodDefault`.
const toTypeName = (def: ZodTypeDef): ZodFirstPartyTypeKind => (def as any).typeName;
const toArgsSchemaType = ({_def}: ZodTypeAny): ArgSchema['type'] => {
	const t = toTypeName(_def);
	switch (t) {
		case ZodFirstPartyTypeKind.ZodBoolean:
			return 'boolean';
		case ZodFirstPartyTypeKind.ZodString:
			return 'string';
		case ZodFirstPartyTypeKind.ZodNumber:
			return 'number';
		case ZodFirstPartyTypeKind.ZodArray:
			return 'string[]'; // TODO support arrays of arbitrary types, or more hardcoded ones as needed
		case ZodFirstPartyTypeKind.ZodUnion:
			return 'string | string[]'; // TODO support unions of arbitrary types, or more hardcoded ones as needed
		default: {
			if ('innerType' in _def) {
				return toArgsSchemaType(_def.innerType);
			} else {
				throw Error('Unknown zod type ' + t);
			}
		}
	}
};
const toArgsSchemaDescription = ({_def}: ZodTypeAny): string => {
	if (_def.description) return _def.description;
	if ('innerType' in _def) {
		return toArgsSchemaDescription(_def.innerType);
	}
	return '';
};
const toArgsSchemaDefault = ({_def}: ZodTypeAny): any => {
	if (_def.defaultValue) return _def.defaultValue();
	if ('innerType' in _def) {
		return toArgsSchemaDefault(_def.innerType);
	}
	return undefined;
};
