import {styleText as st} from 'node:util';
import mri from 'mri';
import type {z} from 'zod';

/**
 * These extend the CLI args for tasks.
 * Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
 * Downstream tasks will see args that upstream events mutate,
 * unless `invoke_task` is called with modified args.
 * Upstream tasks can use listeners to respond to downstream events and values.
 * It's a beautiful mutable spaghetti mess. cant get enough
 * The raw CLI args are handled by `mri` - https://github.com/lukeed/mri
 */
export interface Args {
	_?: Array<string>;
	help?: boolean;
	[key: string]: Arg_Value;
}

export type Arg_Value = string | number | boolean | undefined | Array<string | number | boolean>;

export interface Arg_Schema {
	type: string;
	default: Arg_Value;
	description: string;
}

/**
 * Parses user input args with a Zod schema.
 * Sets the correct source of truth for `no-` versions of args,
 * to the opposite of the unprefixed versions when not included in `unparsed_args`.
 * This is needed because CLI args don't have a normal way of setting falsy values,
 * so instead the args parser `mri` will pass through the truthy versions of args
 * without the `no-` prefix.
 * When we declare task args schemas,
 * we need include both versions with their defaults to get correct `--help` output.
 * Parsing like this also ensures data consistency for both versions because `mri` only creates one.
 * A simpler implementation could replace `mri`, but it handles some finicky details well.
 */
export const parse_args = <
	T_Output extends Record<string, Arg_Value> = Args,
	T_Input extends Record<string, Arg_Value> = Args,
>(
	unparsed_args: T_Input,
	schema: z.ZodType<T_Output, T_Input>,
): z.ZodSafeParseResult<T_Output> => {
	const parsed = schema.safeParse(unparsed_args);
	if (parsed.success) {
		// mutate `data` with the correct source of truth for `no-` prefixed args
		const {data} = parsed;
		for (const key in parsed.data) {
			if (key.startsWith('no-')) {
				const base_key = key.substring(3);
				if (!(key in unparsed_args)) {
					(data as any)[key] = !data[base_key];
				} else if (!(base_key in unparsed_args)) {
					(data as any)[base_key] = !data[key];
				}
			}
		}
	}
	return parsed;
};

/**
 * Serializes parsed `Args` for CLI commands.
 */
export const serialize_args = (args: Args): Array<string> => {
	const result: Array<string> = [];
	const add_value = (name: string, value: string | number | boolean | undefined): void => {
		if (value === undefined) return;
		result.push(name);
		if (typeof value !== 'boolean') {
			result.push(value + '');
		}
	};
	let _: Array<string> | null = null;
	for (const [key, value] of Object.entries(args)) {
		if (key === '_') {
			_ = value ? (value as Array<any>).map((v) => (v === undefined ? '' : v + '')) : [];
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
	const task_name = args._.shift() ?? '';
	if (!args._.length) delete (args as Args)._; // enable schema defaults
	return {task_name, args};
};

/**
 * Gets the array of raw string args starting with the first `--`, if any.
 */
export const to_raw_rest_args = (argv = process.argv): Array<string> => {
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
	raw_rest_args?: Array<string>,
	cache = to_forwarded_args_by_command(raw_rest_args),
): Args => cache[command] ?? {};

export const to_forwarded_args_by_command = (
	raw_rest_args = to_raw_rest_args(),
): Record<string, Args | undefined> => {
	// Parse each segment of `argv` separated by `--`.
	const argvs: Array<Array<string>> = [];
	let arr: Array<string> | undefined;
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

/**
 * Gets all args after the first `--` without assuming a command name.
 * This is useful for tasks that want to forward args directly to a tool
 * without requiring users to specify the tool name explicitly.
 * Optionally strips a specific command name if present for backward compatibility.
 * @example
 * ```ts
 * // `gro test -- --watch` → {watch: true}
 * // `gro test -- foo.test.ts` → {_: ['foo.test.ts']}
 * // `gro test -- vitest --watch` with command_to_strip='vitest' → {watch: true}
 * to_implicit_forwarded_args('vitest')
 * ```
 */
export const to_implicit_forwarded_args = (
	command_to_strip?: string,
	raw_rest_args = to_raw_rest_args(),
): Args => {
	const start = raw_rest_args.indexOf('--');
	if (start === -1) return {};

	let argv = raw_rest_args.slice(start + 1);

	// Backward compat: if first arg matches command, remove it
	if (command_to_strip && argv[0] === command_to_strip) {
		argv = argv.slice(1);
	}

	const args = mri(argv);
	if (!args._.length) delete (args as Args)._;
	return args;
};

export const print_command_args = (serialized_args: Array<string>): string =>
	st('gray', '[') +
	st('magenta', 'running command') +
	st('gray', ']') +
	' ' +
	serialized_args.join(' ');
