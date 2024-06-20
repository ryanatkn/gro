import {cyan, gray, green, red} from 'kleur/colors';
import type {Logger} from '@ryanatkn/belt/log.js';
import {plural} from '@ryanatkn/belt/string.js';
import {print_value} from '@ryanatkn/belt/print.js';
import {ZodFirstPartyTypeKind, type ZodObjectDef, type ZodTypeAny, type ZodTypeDef} from 'zod';

import type {Arg_Schema} from './args.js';
import type {Loaded_Tasks, Task_Module_Meta} from './task.js';
import {print_path} from './paths.js';

export const log_tasks = async (
	log: Logger,
	loaded_tasks: Loaded_Tasks,
	log_intro = true,
): Promise<void> => {
	const {modules, found_tasks} = loaded_tasks;
	const {resolved_input_files_by_root_dir} = found_tasks;

	for (const [root_dir, resolved_input_files] of resolved_input_files_by_root_dir) {
		const dir_label = root_dir === null ? gray('paths') : print_path(root_dir); // TODO BLOCK how to handle null root dirs? what are they exactly, only for absolute paths?
		if (!resolved_input_files.length) {
			log.info(`No tasks found in ${dir_label}.`);
			continue;
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
		const longest_task_name = to_max_length(modules, (m) => m.name);
		for (const resolved_input_file of resolved_input_files) {
			const meta = modules.find((m) => m.id === resolved_input_file.id)!;
			logged.push(
				'\n' + cyan(pad(meta.name, longest_task_name)),
				'  ',
				meta.mod.task.summary || '',
			);
		}
		log[log_intro ? 'info' : 'plain'](logged.join('') + '\n');
	}
};

// TODO BLOCK delete after getting the generic version working, maybe need `print_input_path`
// export const log_gro_package_tasks = async (
// 	input_path: Input_Path,
// 	task_root_dirs: Path_Id[],
// 	log: Logger,
// ): Promise<Find_Tasks_Result> => {
// 	const gro_dir_input_path = to_gro_input_path(input_path);
// 	const gro_dir_find_tasks_result = await find_tasks([gro_dir_input_path], task_root_dirs);
// 	console.log(`[log_gro_package_tasks] gro_dir_find_tasks_result`, gro_dir_find_tasks_result);
// 	if (gro_dir_find_tasks_result.ok) {
// 		const gro_path_data =
// 			gro_dir_find_tasks_result.resolved_input_paths_by_input_path.get(gro_dir_input_path)!;
// 		// Log the Gro matches.
// 		await log_tasks(
// 			log,
// 			print_path(gro_path_data.id),
// 			gro_dir_find_tasks_result.resolved_input_files,
// 			task_root_dirs,
// 		);
// 	}
// 	return gro_dir_find_tasks_result;
// };
// TODO BLOCK used above, I don't think this is valid any more, we shouldn't transform absolute paths like this,
// the searching should happen with the input paths
// const to_gro_input_path = (input_path: Input_Path): Input_Path => {
// 	const base_path = input_path === paths.lib.slice(0, -1) ? '' : strip_start(input_path, paths.lib);
// 	return GRO_DIST_DIR + base_path;
// };

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
