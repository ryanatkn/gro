import {type JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import {magenta} from 'kleur/colors';
import mri from 'mri';

// These extend the CLI args for tasks.
// Anything can be assigned to a task's `args`. It's just a mutable POJO dictionary.
// Downstream tasks will see args that upstream events mutate,
// unless `invokeTask` is called with modified args.
// Upstream tasks can use listeners to respond to downstream events and values.
// It's a beautiful mutable spaghetti mess. cant get enough
// The raw CLI ares are handled by `mri` - https://github.com/lukeed/mri
export interface Args {
	_?: string[];
	help?: boolean;
	[key: string]: ArgValue;
}

export type ArgValue = string | number | boolean | undefined | Array<string | number | boolean>;

export const serializeArgs = (args: Args): string[] => {
	const result: string[] = [];
	const addValue = (name: string, value: string | number | boolean | undefined): void => {
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
				for (const v of value) addValue(name, v);
			} else {
				addValue(name, value);
			}
		}
	}
	return _ ? [..._, ...result] : result;
};

// TODO allow schema composition with things like `allOf` instead of requiring properties
// TODO should this extend `VocabSchema` so we get `$id`?
export interface ArgsSchema extends JSONSchema {
	type: 'object';
	properties: ArgsProperties;
}

export type ArgsProperties = Record<string, ArgSchema> & {
	_?: {
		type: 'array';
		items: {type: 'string'};
		default: any[] | undefined;
		description: string;
	} & JSONSchema;
};

export interface ArgSchema extends JSONSchema {
	type: 'boolean' | 'string' | 'number' | 'array';
	default: ArgValue;
	description: string;
}

/**
 * Parses `taskName` and `args` from `process.argv` using `mri`,
 * ignoring anything after any `--`.
 */
export const toTaskArgs = (argv = process.argv): {taskName: string; args: Args} => {
	const forwardedIndex = argv.indexOf('--');
	const args = mri(forwardedIndex === -1 ? argv.slice(2) : argv.slice(2, forwardedIndex));
	const taskName = args._.shift() || '';
	if (args._.length === 0) delete (args as Args)._; // enable schema defaults
	return {taskName, args};
};

/**
 * Gets the array of raw string args starting with the first `--`, if any.
 */
export const toRawRestArgs = (argv = process.argv): string[] => {
	const forwardedIndex = argv.indexOf('--');
	return forwardedIndex === -1 ? [] : argv.slice(forwardedIndex);
};

/**
 * Parses `process.argv` for the specified `command`, so given
 * `gro taskname arg1 --arg2 -- eslint eslintarg1 --eslintarg2 -- tsc --tscarg1 --tscarg2`
 * the `command` `'eslint'` returns `eslintarg1 --eslintarg2`
 * and `'tsc'` returns `--tscarg1` and `--tscarg2`.
 */
export const toForwardedArgs = (
	command: string,
	reset = false,
	rawRestArgs = toRawRestArgs(),
): Args => toForwardedArgsByCommand(reset, rawRestArgs)[command] || {};

let _forwardedArgsByCommand: Record<string, Args> | undefined;

export const toForwardedArgsByCommand = (
	reset = false,
	rawRestArgs = toRawRestArgs(),
): Record<string, Args> => {
	if (reset) _forwardedArgsByCommand = undefined;
	if (_forwardedArgsByCommand) return _forwardedArgsByCommand;
	// Parse each segment of `argv` separated by `--`.
	const argvs: string[][] = [];
	let arr: string[] | undefined;
	for (const arg of rawRestArgs) {
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
	_forwardedArgsByCommand = {};
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
		_forwardedArgsByCommand[command] = args;
	}
	return _forwardedArgsByCommand;
};

/**
 * Mutates `args` to add `value` on either key `a` or `b`. (to handle shorthand/longhand form)
 * If `value` is a boolean, it always overwrites the existing value.
 * If `value` is a string or number, it'll be added to an array.
 * To treat `value` as a primitive in all cases, pass `array` `false`.
 * @param args
 * @param value
 * @param a
 * @param b
 * @param array
 */
export const addArg = (
	args: Args,
	value: string | number | boolean,
	a: string,
	b = a,
	array = typeof value !== 'boolean',
): void => {
	if (args[a] === undefined && args[b] === undefined) {
		args[a] = value;
	} else {
		const arg = args[a] !== undefined ? a : b;
		if (!array) {
			args[arg] = value;
		} else if (Array.isArray(args[arg])) {
			(args as any)[arg].push(value);
		} else {
			args[arg] = [(args as any)[arg], value];
		}
	}
};

export const printCommandArgs = (serializedArgs: string[]): string =>
	magenta('running command: ') + serializedArgs.join(' ');
