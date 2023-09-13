import {magenta} from 'kleur/colors';
import mri from 'mri';

// These extend the CLI args for tasks.
// Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
// Downstream tasks will see args that upstream events mutate,
// unless `invoke_task` is called with modified args.
// Upstream tasks can use listeners to respond to downstream events and values.
// It's a beautiful mutable spaghetti mess. cant get enough
// The raw CLI ares are handled by `mri` - https://github.com/lukeed/mri
export interface Args {
	_?: string[];
	help?: boolean;
	[key: string]: ArgValue;
}

export type ArgValue = string | number | boolean | undefined | Array<string | number | boolean>;

export interface ArgSchema {
	type: 'boolean' | 'string' | 'number' | 'string[]' | 'string | string[]';
	default: ArgValue;
	description: string;
}

export const serialize_args = (args: Args): string[] => {
	const result: string[] = [];
	const add_value = (name: string, value: string | number | boolean | undefined): void => {
		if (value === undefined) return;
		result.push(name);
		if (typeof value !== 'boolean') {
			result.push((value as any) + '');
		}
	};
	let _: string[] | null = null;
	for (const [key, value] of Object.entries(args)) {
		if (key === '_') {
			_ = value ? (value as any[]).map((v) => (v === undefined ? '' : v + '')) : [];
		} else {
			const name = `${key.length === 1 ? '-' : '--'}${key}`;
			if (Array.isArray(value)) {
				for (const v of value) add_value(name, v);
			} else {
				add_value(name, value);
			}
		}
	}
	return _ ? [..._, ...result] : result;
};

/**
 * Parses `task_name` and `args` from `process.argv` using `mri`,
 * ignoring anything after any `--`.
 */
export const to_task_args = (argv = process.argv): {task_name: string; args: Args} => {
	const forwarded_index = argv.indexOf('--');
	const args = mri(forwarded_index === -1 ? argv.slice(2) : argv.slice(2, forwarded_index));
	const task_name = args._.shift() || '';
	if (!args._.length) delete (args as Args)._; // enable schema defaults
	return {task_name, args};
};

/**
 * Gets the array of raw string args starting with the first `--`, if any.
 */
export const to_raw_rest_args = (argv = process.argv): string[] => {
	const forwarded_index = argv.indexOf('--');
	return forwarded_index === -1 ? [] : argv.slice(forwarded_index);
};

/**
 * Parses `process.argv` for the specified `command`, so given
 * `gro taskname arg1 --arg2 -- eslint eslintarg1 --eslintarg2 -- tsc --tscarg1 --tscarg2`
 * the `command` `'eslint'` returns `eslintarg1 --eslintarg2`
 * and `'tsc'` returns `--tscarg1` and `--tscarg2`.
 */
export const to_forwarded_args = (
	command: string,
	raw_rest_args?: string[],
	cache = to_forwarded_args_by_command(raw_rest_args),
): Args => cache[command] || {};

export const to_forwarded_args_by_command = (
	raw_rest_args = to_raw_rest_args(),
): Record<string, Args> => {
	// Parse each segment of `argv` separated by `--`.
	const argvs: string[][] = [];
	let arr: string[] | undefined;
	for (const arg of raw_rest_args) {
		if (arg === '--') {
			if (arr?.length) argvs.push(arr);
			arr = [];
		} else if (!arr) {
			continue;
		} else if (arg) {
			arr.push(arg);
		}
	}
	if (arr?.length) argvs.push(arr);
	// Add each segment of parsed `argv` keyed by the first rest arg,
	// which is assumed to be the CLI command that gets forwarded the args.
	const forwarded_args_by_command: Record<string, Args> = {};
	for (const argv of argvs) {
		const args = mri(argv);
		let command = args._.shift();
		if (!command) {
			throw Error(
				`Malformed args following a \`--\`. Expected a rest arg command: \`${argv.join(' ')}\``,
			);
		}
		// Gro commands get combined with their task name.
		if (command === 'gro') {
			if (!args._.length) {
				throw Error(
					`Malformed args following a \`--\`. Expected gro taskname: \`${argv.join(' ')}\``,
				);
			}
			command += ' ' + args._.shift();
		}
		if (!args._.length) delete (args as Args)._;
		forwarded_args_by_command[command] = args;
	}
	return forwarded_args_by_command;
};

export const print_command_args = (serialized_args: string[]): string =>
	magenta('running command: ') + serialized_args.join(' ');
