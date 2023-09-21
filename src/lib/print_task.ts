import {cyan, gray, green, red} from 'kleur/colors';
import type {Logger} from '@feltjs/util/log.js';
import {plural} from '@feltjs/util/string.js';
import {printValue} from '@feltjs/util/print.js';
import {ZodFirstPartyTypeKind, type ZodObjectDef, type ZodTypeAny, type ZodTypeDef} from 'zod';

import type {ArgSchema} from './args.js';
import {load_modules} from './modules.js';
import {load_task_module, type TaskModuleMeta} from './task_module.js';

export const log_available_tasks = async (
	log: Logger,
	dir_label: string,
	source_ids_by_input_path: Map<string, string[]>,
	print_intro = true,
): Promise<void> => {
	const source_ids = Array.from(source_ids_by_input_path.values()).flat();
	if (source_ids.length) {
		// Load all of the tasks so we can print their summary, and args for the `--help` flag.
		const load_modules_result = await load_modules(source_ids_by_input_path, load_task_module);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			process.exit(1);
		}
		const printed: string[] = [
			`${print_intro ? '\n\n' : ''}${source_ids.length} task${plural(
				source_ids.length,
			)} in ${dir_label}:\n`,
		];
		if (print_intro) {
			printed.unshift(
				`\n\n${gray('Run a task:')} gro [name]`,
				`\n${gray('View help:')}  gro [name] --help`,
			);
		}
		const longest_task_name = to_max_length(load_modules_result.modules, (m) => m.name);
		for (const meta of load_modules_result.modules) {
			printed.push(
				'\n' + cyan(pad(meta.name, longest_task_name)),
				'  ',
				meta.mod.task.summary || '',
			);
		}
		log[print_intro ? 'info' : 'plain'](printed.join('') + '\n');
	} else {
		log.info(`No tasks found in ${dir_label}.`);
	}
};

export const log_error_reasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(red(reason));
	}
};

const ARGS_PROPERTY_NAME = '[...args]';

export const print_task_help = (log: Logger, meta: TaskModuleMeta): void => {
	const {
		name,
		mod: {task},
	} = meta;
	const printed: string[] = [];
	printed.push(
		cyan(name),
		'help',
		cyan(`\n\ngro ${name}`) + `: ${task.summary || '(no summary available)'}\n`,
	);
	if (task.Args) {
		const properties = to_arg_properties(task.Args._def, meta);
		// TODO hacky padding for some quick and dirty tables
		const longest_task_name = Math.max(
			ARGS_PROPERTY_NAME.length,
			to_max_length(properties, (p) => p.name),
		);
		const longest_type = to_max_length(properties, (p) => p.schema.type);
		const longest_default = to_max_length(properties, (p) => printValue(p.schema.default));
		for (const property of properties) {
			const name = property.name === '_' ? ARGS_PROPERTY_NAME : property.name;
			printed.push(
				`\n${green(pad(name, longest_task_name))} `,
				gray(pad(property.schema.type, longest_type)) + ' ',
				pad(printValue(property.schema.default), longest_default) + ' ',
				property.schema.description || '(no description available)',
			);
		}
	}
	log.info(...printed, '\n');
};

interface ArgSchemaProperty {
	name: string;
	schema: ArgSchema;
}

const to_arg_properties = (def: ZodTypeDef, meta: TaskModuleMeta): ArgSchemaProperty[] => {
	const type_name = to_type_name(def);
	if (type_name !== ZodFirstPartyTypeKind.ZodObject) {
		throw Error(
			`Expected Args for task "${meta.name}" to be a ZodObject schema but got ${type_name}`,
		);
	}
	const shape = (def as ZodObjectDef).shape();
	const properties: ArgSchemaProperty[] = [];
	for (const name in shape) {
		if ('no-' + name in shape) continue;
		const s = shape[name];
		const schema: ArgSchema = {
			type: to_args_schema_type(s),
			description: to_args_schema_description(s),
			default: to_args_schema_default(s),
		};
		properties.push({name, schema});
	}
	return properties;
};

// quick n dirty padding logic
const pad = (s: string, n: number): string => s + ' '.repeat(n - s.length);
const to_max_length = <T>(items: T[], toString: (item: T) => string) =>
	items.reduce((max, m) => Math.max(toString(m).length, max), 0);

// The following Zod helpers only need to support single-depth schemas for CLI args,
// but there's generic recursion to handle things like `ZodOptional` and `ZodDefault`.
const to_type_name = (def: ZodTypeDef): ZodFirstPartyTypeKind => (def as any).typeName;
const to_args_schema_type = ({_def}: ZodTypeAny): ArgSchema['type'] => {
	const t = to_type_name(_def);
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
				return to_args_schema_type(_def.innerType);
			} else {
				throw Error('Unknown zod type ' + t);
			}
		}
	}
};
const to_args_schema_description = ({_def}: ZodTypeAny): string => {
	if (_def.description) return _def.description;
	if ('innerType' in _def) {
		return to_args_schema_description(_def.innerType);
	}
	return '';
};
const to_args_schema_default = ({_def}: ZodTypeAny): any => {
	if (_def.defaultValue) return _def.defaultValue();
	if ('innerType' in _def) {
		return to_args_schema_default(_def.innerType);
	}
	return undefined;
};
