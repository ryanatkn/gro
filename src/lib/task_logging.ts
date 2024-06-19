import {cyan, gray, green, red} from 'kleur/colors';
import type {Logger} from '@ryanatkn/belt/log.js';
import {plural, strip_start} from '@ryanatkn/belt/string.js';
import {print_value} from '@ryanatkn/belt/print.js';
import {ZodFirstPartyTypeKind, type ZodObjectDef, type ZodTypeAny, type ZodTypeDef} from 'zod';

import type {Arg_Schema} from './args.js';
import {load_modules} from './modules.js';
import {
	find_tasks,
	load_task_module,
	type Find_Tasks_Result,
	type Task_Module_Meta,
} from './task_module.js';
import type {Input_Path, Resolved_Input_File} from './input_path.js';
import {GRO_DIST_DIR, paths, print_path} from './paths.js';

export const log_tasks = async (
	log: Logger,
	dir_label: string,
	resolved_input_files: Resolved_Input_File[],
	task_root_paths: string[],
	log_intro = true,
): Promise<void> => {
	if (resolved_input_files.length) {
		// Load all of the tasks so we can log their summary, and args for the `--help` flag.
		const load_modules_result = await load_modules(resolved_input_files, (id) =>
			load_task_module(id, task_root_paths),
		);
		if (!load_modules_result.ok) {
			log_error_reasons(log, load_modules_result.reasons);
			process.exit(1);
		}
		const logged: string[] = [
			`${log_intro ? '\n\n' : ''}${resolved_input_files.length} task${plural(
				resolved_input_files.length,
			)} in ${dir_label}:\n`,
		];
		if (log_intro) {
			logged.unshift(
				`\n\n${gray('Run a task:')} gro [name]`,
				`\n${gray('View help:')}  gro [name] --help`,
			);
		}
		const longest_task_name = to_max_length(load_modules_result.modules, (m) => m.name);
		for (const meta of load_modules_result.modules) {
			logged.push(
				'\n' + cyan(pad(meta.name, longest_task_name)),
				'  ',
				meta.mod.task.summary || '',
			);
		}
		log[log_intro ? 'info' : 'plain'](logged.join('') + '\n');
	} else {
		log.info(`No tasks found in ${dir_label}.`);
	}
};

// TODO BLOCK probably rewrite this
export const log_gro_package_tasks = async (
	input_path: Input_Path,
	task_root_paths: string[],
	log: Logger,
): Promise<Find_Tasks_Result> => {
	const gro_dir_input_path = to_gro_input_path(input_path);
	const gro_dir_find_tasks_result = await find_tasks([gro_dir_input_path], task_root_paths);
	console.log(`[log_gro_package_tasks] gro_dir_find_tasks_result`, gro_dir_find_tasks_result);
	if (gro_dir_find_tasks_result.ok) {
		const gro_path_data =
			gro_dir_find_tasks_result.resolved_input_path_by_input_path.get(gro_dir_input_path)!;
		// Log the Gro matches.
		await log_tasks(
			log,
			print_path(gro_path_data.id),
			gro_dir_find_tasks_result.resolved_input_files,
			task_root_paths,
		);
	}
	return gro_dir_find_tasks_result;
};
// TODO BLOCK used above, I don't think this is valid any more, we shouldn't transform absolute paths like this,
// the searching should happen with the input paths
const to_gro_input_path = (input_path: Input_Path): Input_Path => {
	const base_path = input_path === paths.lib.slice(0, -1) ? '' : strip_start(input_path, paths.lib);
	return GRO_DIST_DIR + base_path;
};

export const log_error_reasons = (log: Logger, reasons: string[]): void => {
	for (const reason of reasons) {
		log.error(red(reason));
	}
};

const ARGS_PROPERTY_NAME = '[...args]';

export const log_task_help = (log: Logger, meta: Task_Module_Meta): void => {
	const {
		name,
		mod: {task},
	} = meta;
	const logged: string[] = [];
	logged.push(
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
		const longest_default = to_max_length(properties, (p) => print_value(p.schema.default));
		for (const property of properties) {
			const name = property.name === '_' ? ARGS_PROPERTY_NAME : property.name;
			logged.push(
				`\n${green(pad(name, longest_task_name))} `,
				gray(pad(property.schema.type, longest_type)) + ' ',
				pad(print_value(property.schema.default), longest_default) + ' ',
				property.schema.description || '(no description available)',
			);
		}
		if (!properties.length) {
			logged.push('\n' + gray('this task has no args'));
		}
	}
	log.info(...logged, '\n');
};

interface Arg_Schema_Property {
	name: string;
	schema: Arg_Schema;
}

const to_arg_properties = (def: ZodTypeDef, meta: Task_Module_Meta): Arg_Schema_Property[] => {
	const type_name = to_type_name(def);
	if (type_name !== ZodFirstPartyTypeKind.ZodObject) {
		throw Error(
			`Expected Args for task "${meta.name}" to be a ZodObject schema but got ${type_name}`,
		);
	}
	const shape = (def as ZodObjectDef).shape();
	const properties: Arg_Schema_Property[] = [];
	for (const name in shape) {
		if ('no-' + name in shape) continue;
		const s = shape[name];
		const schema: Arg_Schema = {
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
const to_args_schema_type = ({_def}: ZodTypeAny): Arg_Schema['type'] => {
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
		case ZodFirstPartyTypeKind.ZodEnum:
			return _def.values.map((v: string) => `'${v}'`).join(' | ');
		case ZodFirstPartyTypeKind.ZodUnion:
			return 'string | string[]'; // TODO support unions of arbitrary types, or more hardcoded ones as needed
		default: {
			const subschema = to_subschema(_def);
			if (subschema) {
				return to_args_schema_type(subschema);
			} else {
				throw Error('Unknown zod type ' + t);
			}
		}
	}
};
const to_args_schema_description = ({_def}: ZodTypeAny): string => {
	if (_def.description) {
		return _def.description;
	}
	const subschema = to_subschema(_def);
	if (subschema) {
		return to_args_schema_description(subschema);
	}
	return '';
};
const to_args_schema_default = ({_def}: ZodTypeAny): any => {
	if (_def.defaultValue) {
		return _def.defaultValue();
	}
	const subschema = to_subschema(_def);
	if (subschema) {
		return to_args_schema_default(subschema);
	}
	return undefined;
};

const to_subschema = (_def: any): ZodTypeAny | undefined => {
	if ('type' in _def) {
		return _def.type;
	} else if ('innerType' in _def) {
		return _def.innerType;
	} else if ('schema' in _def) {
		return _def.schema;
	}
	return undefined;
};
