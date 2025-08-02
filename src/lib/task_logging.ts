import {styleText as st} from 'node:util';
import type {Logger} from '@ryanatkn/belt/log.js';
import {plural} from '@ryanatkn/belt/string.js';
import {print_value} from '@ryanatkn/belt/print.js';
import {z} from 'zod';

import type {Arg_Schema} from './args.ts';
import type {Loaded_Tasks, Task_Module_Meta} from './task.ts';
import {print_path} from './paths.ts';

export const log_tasks = (log: Logger, loaded_tasks: Loaded_Tasks, log_intro = true): void => {
	const {modules, found_tasks} = loaded_tasks;
	const {resolved_input_files_by_root_dir} = found_tasks;

	const logged: Array<string> = [];
	if (log_intro) {
		logged.unshift(
			`\n\n${st('gray', 'Run a task:')} gro [name]`,
			`\n${st('gray', 'View help:')}  gro [name] --help`,
		);
	}

	for (const [root_dir, resolved_input_files] of resolved_input_files_by_root_dir) {
		const dir_label = print_path(root_dir);
		if (!resolved_input_files.length) {
			log.info(`No tasks found in ${dir_label}.`);
			continue;
		}
		logged.push(
			`${log_intro ? '\n\n' : ''}${resolved_input_files.length} task${plural(
				resolved_input_files.length,
			)} in ${dir_label}:\n`,
		);
		const longest_task_name = to_max_length(modules, (m) => m.name);
		for (const resolved_input_file of resolved_input_files) {
			const meta = modules.find((m) => m.id === resolved_input_file.id)!;
			logged.push(
				'\n' + st('cyan', meta.name.padEnd(longest_task_name)),
				'  ',
				meta.mod.task.summary ?? '',
			);
		}
	}
	log[log_intro ? 'info' : 'plain'](logged.join('') + '\n');
};

export const log_error_reasons = (log: Logger, reasons: Array<string>): void => {
	for (const reason of reasons) {
		log.error(st('red', reason));
	}
};

const ARGS_PROPERTY_NAME = '[...args]';

export const log_task_help = (log: Logger, meta: Task_Module_Meta): void => {
	const {
		name,
		mod: {task},
	} = meta;
	const logged: Array<string> = [];
	logged.push(
		st('cyan', name),
		'help',
		st('cyan', `\n\ngro ${name}`) + `: ${task.summary ?? '(no summary available)'}\n`,
	);
	if (task.Args) {
		const properties = to_arg_properties(task.Args, meta);
		// TODO hacky padding for some quick and dirty tables
		const longest_task_name = Math.max(
			ARGS_PROPERTY_NAME.length,
			to_max_length(properties, (p) => p.name),
		);
		const longest_type = to_max_length(properties, (p) => p.schema.type);
		const longest_default = to_max_length(properties, (p) => print_value(p.schema.default));
		for (const property of properties) {
			const name = property.name === '_' ? ARGS_PROPERTY_NAME : property.name;
			logged.push(
				`\n${st('green', name.padEnd(longest_task_name))} `,
				st('gray', property.schema.type.padEnd(longest_type)) + ' ',
				print_value(property.schema.default).padEnd(longest_default) + ' ',
				property.schema.description || '(no description available)',
			);
		}
		if (!properties.length) {
			logged.push('\n' + st('gray', 'this task has no args'));
		}
	}
	log.info(...logged, '\n');
};

// TODO rework all of this
// The following Zod helpers only need to support single-depth schemas for CLI args,
// but there's generic recursion to handle things like `ZodOptional` and `ZodDefault`.

interface Arg_Schema_Property {
	name: string;
	schema: Arg_Schema;
}

// TODO this blocks many usecases like unions, need better support for arbitrary schemas
const to_arg_properties = (
	schema: z.ZodType,
	meta: Task_Module_Meta,
): Array<Arg_Schema_Property> => {
	const {def} = schema;

	// TODO overly restrictive, support optional objects and/or unions?
	if (!('shape' in def)) {
		throw new Error(
			`Expected Args for task "${meta.name}" to be an object schema but got ${def.type}`,
		);
	}
	const shape = (def as z.core.$ZodObjectDef).shape;

	const properties: Array<Arg_Schema_Property> = [];
	for (const name in shape) {
		if ('no-' + name in shape) continue;
		const s = shape[name] as z.ZodType;
		const schema: Arg_Schema = {
			type: to_args_schema_type(s),
			description: to_args_schema_description(s) || '',
			default: to_args_schema_default(s),
		};
		properties.push({name, schema});
	}
	return properties;
};

const to_max_length = <T>(items: Array<T>, toString: (item: T) => string) =>
	items.reduce((max, m) => Math.max(toString(m).length, max), 0);

const to_args_schema_type = (schema: z.ZodType): Arg_Schema['type'] => {
	const {def} = schema._zod;
	switch (def.type) {
		case 'string':
			return 'string';
		case 'number':
			return 'number';
		case 'int':
			return 'int';
		case 'boolean':
			return 'boolean';
		case 'bigint':
			return 'bigint';
		case 'symbol':
			return 'symbol';
		case 'null':
			return 'null';
		case 'undefined':
			return 'undefined';
		case 'void':
			return 'void';
		case 'never':
			return 'never';
		case 'any':
			return 'any';
		case 'unknown':
			return 'unknown';
		case 'date':
			return 'date';
		case 'object':
			return 'object';
		case 'record':
			return 'record';
		case 'file':
			return 'file';
		case 'array':
			// TODO other types, only handling a subset of CLI arg cases
			return 'Array<string>';
		case 'tuple':
			return 'tuple';
		case 'union':
			// TODO fix, this is a hacky way to handle unions for CLI args
			return 'string | Array<string>';
		case 'intersection':
			return 'intersection';
		case 'map':
			return 'map';
		case 'set':
			return 'set';
		case 'enum':
			return (schema as unknown as {options: Array<string>}).options
				.map((v) => `'${v}'`)
				.join(' | ');
		case 'literal':
			return (def as unknown as {values: Array<any>}).values.map((v) => print_value(v)).join(' | ');
		case 'nullable': {
			const subschema = to_subschema(def);
			if (subschema) {
				return to_args_schema_type(subschema) + ' | null';
			} else {
				return 'nullable';
			}
		}
		case 'optional': {
			const subschema = to_subschema(def);
			if (subschema) {
				return to_args_schema_type(subschema) + ' | undefined';
			} else {
				return 'optional';
			}
		}
		case 'success':
			return 'success';
		case 'catch':
			return 'catch';
		case 'nan':
			return 'NaN';
		case 'readonly':
			return 'readonly';
		case 'template_literal':
			return 'template_literal';
		case 'promise':
			return 'promise';
		case 'lazy':
			return 'lazy';
		case 'custom':
			return 'custom';
		// Unwrap these:
		// case 'nonoptional':
		// case 'transform':
		// case 'default':
		// case 'prefault':
		// case 'pipe':
		default: {
			const subschema = to_subschema(def);
			if (subschema) {
				return to_args_schema_type(subschema);
			} else {
				throw new Error(`Unhandled Zod type: ${def.type}`);
			}
		}
	}
};

const to_args_schema_description = (schema: z.ZodType): string | null => {
	const meta = schema.meta();
	if (meta?.description) {
		return meta.description;
	}
	const subschema = to_subschema(schema.def);
	if (subschema) {
		return to_args_schema_description(subschema);
	}
	return null;
};

const to_args_schema_default = (schema: z.ZodType): any => {
	const {def} = schema._zod;
	if ('defaultValue' in def) {
		return def.defaultValue;
	}
	const subschema = to_subschema(def);
	if (subschema) {
		return to_args_schema_default(subschema);
	}
};

const to_subschema = (def: z.core.$ZodTypeDef): z.ZodType | undefined => {
	if ('innerType' in def) {
		return def.innerType as any;
	} else if ('in' in def) {
		return def.in as any;
	} else if ('schema' in def) {
		return def.schema as any;
	}
	return undefined;
};
