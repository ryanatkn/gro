import {describe, test, expect} from 'vitest';
import mri from 'mri';

import {
	serialize_args,
	to_forwarded_args,
	to_forwarded_args_by_command,
	to_raw_rest_args,
	to_implicit_forwarded_args,
	to_task_args,
} from './args.ts';

describe('serialize_args', () => {
	test('basic behavior', () => {
		const raw = ['a', '-i', '1', 'b', 'c', '-i', '-i', 'three'];
		const parsed = mri(raw);
		expect(parsed).toEqual({_: ['a', 'b', 'c'], i: [1, true, 'three']});
		const serialized = serialize_args(parsed);
		expect(serialized).toEqual(['a', 'b', 'c', '-i', '1', '-i', '-i', 'three']); // sorted
	});

	test('empty object', () => {
		expect(serialize_args({})).toEqual([]);
	});

	test('only flags', () => {
		const serialized = serialize_args({watch: true, coverage: true});
		expect(serialized).toEqual(['--watch', '--coverage']);
	});

	test('undefined values filtered', () => {
		const serialized = serialize_args({watch: undefined, coverage: true});
		expect(serialized).toEqual(['--coverage']);
	});

	test('empty _ array', () => {
		const serialized = serialize_args({_: []});
		expect(serialized).toEqual([]);
	});

	test('single char flags', () => {
		const serialized = serialize_args({w: true, t: 'foo'});
		expect(serialized).toEqual(['-w', '-t', 'foo']);
	});

	test('mixed single and double dash', () => {
		const serialized = serialize_args({w: true, watch: true});
		expect(serialized).toEqual(['-w', '--watch']);
	});

	test('array values', () => {
		const serialized = serialize_args({flag: ['a', 'b', 'c']});
		expect(serialized).toEqual(['--flag', 'a', '--flag', 'b', '--flag', 'c']);
	});

	test('positionals come first', () => {
		const serialized = serialize_args({_: ['foo', 'bar'], watch: true});
		expect(serialized).toEqual(['foo', 'bar', '--watch']);
	});
});

describe('to_forwarded_args_by_command', () => {
	test('basic behavior', () => {
		const raw_rest_args = to_raw_rest_args(
			(
				'gro taskname a b c --d -e 1 --     --    ' +
				'eslint  a  --b    c --  ' +
				'gro  a --a  --   ' +
				'tsc  -b  --    ' +
				'gro b -t2 t2a --t2 t2b --t222 2 --     --      --    ' +
				'groc --m --n nn -- ' +
				'gro d -b a --c 4 -- ' +
				'gro d -b a --c 5 -- '
			).split(' '),
		);
		expect(to_forwarded_args_by_command(raw_rest_args)).toEqual({
			eslint: {_: ['a'], b: 'c'},
			'gro a': {a: true},
			tsc: {b: true},
			'gro b': {'2': 't2a', t: true, t2: 't2b', t222: 2},
			groc: {m: true, n: 'nn'},
			'gro d': {b: 'a', c: 5},
		});
		expect(to_forwarded_args('gro b', raw_rest_args)).toEqual({
			'2': 't2a',
			t: true,
			t2: 't2b',
			t222: 2,
		});
	});

	test('throws when no command after --', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --flag'.split(' '));
		expect(() => to_forwarded_args_by_command(raw_rest_args)).toThrow(
			'Malformed args following a `--`. Expected a rest arg command',
		);
	});

	test('throws when gro without taskname', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- gro'.split(' '));
		expect(() => to_forwarded_args_by_command(raw_rest_args)).toThrow(
			'Malformed args following a `--`. Expected gro taskname',
		);
	});

	test('throws when gro with only flags', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- gro --flag'.split(' '));
		expect(() => to_forwarded_args_by_command(raw_rest_args)).toThrow(
			'Malformed args following a `--`. Expected gro taskname',
		);
	});
});

describe('to_implicit_forwarded_args', () => {
	test('implicit flags only', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --watch --coverage'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			watch: true,
			coverage: true,
		});
	});

	test('positional args only', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- foo.test.ts bar.test.ts'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			_: ['foo.test.ts', 'bar.test.ts'],
		});
	});

	test('command stripping for backward compat', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- vitest --watch --coverage'.split(' '));
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			watch: true,
			coverage: true,
		});
	});

	test('command stripping does nothing if command not present', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --watch --coverage'.split(' '));
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			watch: true,
			coverage: true,
		});
	});

	test('mixed flags and positionals', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- foo.test.ts --watch --coverage'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			_: ['foo.test.ts'],
			watch: true,
			coverage: true,
		});
	});

	test('no forwarded args', () => {
		const raw_rest_args = to_raw_rest_args('gro test'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({});
	});

	test('empty args after --', () => {
		const raw_rest_args = to_raw_rest_args('gro test --'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({});
	});

	test('parses all args after first -- (mri handles -- separator)', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --watch -- eslint --fix'.split(' '));
		// mri treats everything after first -- as input, and filters internal -- separators
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			_: ['eslint', '--fix'],
			watch: true,
		});
	});

	test('complex real-world example', () => {
		const raw_rest_args = to_raw_rest_args(
			'gro test -- vitest src/*.test.ts --watch --coverage'.split(' '),
		);
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			_: ['src/*.test.ts'],
			watch: true,
			coverage: true,
		});
	});

	test('command stripping with multiple -- sections', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- vitest --watch -- other --flag'.split(' '));
		// Strips 'vitest', mri handles the rest
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			_: ['other', '--flag'],
			watch: true,
		});
	});

	test('command stripping does not affect later positionals', () => {
		const raw_rest_args = to_raw_rest_args(
			'gro test -- vitest --watch -- vitest --another'.split(' '),
		);
		// Only strips first 'vitest', second one becomes positional
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			_: ['vitest', '--another'],
			watch: true,
		});
	});

	test('wrong command to strip with multiple sections', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- eslint --fix -- vitest --watch'.split(' '));
		// command_to_strip='vitest' but first arg is 'eslint', so nothing stripped
		// mri parses --fix as a flag, not a positional
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			_: ['eslint', 'vitest', '--watch'],
			fix: true,
		});
	});

	test('command name as flag value should not be stripped', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --tool vitest --watch'.split(' '));
		// 'vitest' is value for --tool flag, not first positional
		expect(to_implicit_forwarded_args('vitest', raw_rest_args)).toEqual({
			tool: 'vitest',
			watch: true,
		});
	});

	test('numeric positionals', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- 123 456 --count 789'.split(' '));
		// mri keeps positionals as strings from argv, but parses flag values as numbers
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			_: ['123', '456'],
			count: 789,
		});
	});

	test('flags with = syntax', () => {
		const raw_rest_args = to_raw_rest_args('gro test -- --foo=bar --baz=qux'.split(' '));
		expect(to_implicit_forwarded_args(undefined, raw_rest_args)).toEqual({
			foo: 'bar',
			baz: 'qux',
		});
	});
});

describe('to_task_args', () => {
	test('basic task with flags', () => {
		const result = to_task_args(['node', 'gro', 'test', '--watch']);
		expect(result).toEqual({
			task_name: 'test',
			args: {watch: true},
		});
	});

	test('task with positionals', () => {
		const result = to_task_args(['node', 'gro', 'test', 'foo.ts', 'bar.ts']);
		expect(result).toEqual({
			task_name: 'test',
			args: {_: ['foo.ts', 'bar.ts']},
		});
	});

	test('stops parsing at --', () => {
		const result = to_task_args(['node', 'gro', 'test', '--watch', '--', 'vitest', '--coverage']);
		expect(result).toEqual({
			task_name: 'test',
			args: {watch: true},
		});
	});

	test('no task name', () => {
		const result = to_task_args(['node', 'gro', '--help']);
		expect(result).toEqual({
			task_name: '',
			args: {help: true},
		});
	});

	test('empty _ array removed to enable schema defaults', () => {
		const result = to_task_args(['node', 'gro', 'test']);
		expect(result).toEqual({
			task_name: 'test',
			args: {},
		});
		expect(result.args._).toBeUndefined();
	});

	test('task name from positionals', () => {
		const result = to_task_args(['node', 'gro', 'build']);
		expect(result).toEqual({
			task_name: 'build',
			args: {},
		});
	});

	test('mixed flags and positionals', () => {
		const result = to_task_args(['node', 'gro', 'test', 'foo.ts', 'bar.ts', '--watch']);
		expect(result).toEqual({
			task_name: 'test',
			args: {_: ['foo.ts', 'bar.ts'], watch: true},
		});
	});
});

describe('to_raw_rest_args', () => {
	test('with --', () => {
		const result = to_raw_rest_args(['node', 'gro', 'test', '--', 'foo']);
		expect(result).toEqual(['--', 'foo']);
	});

	test('without --', () => {
		const result = to_raw_rest_args(['node', 'gro', 'test']);
		expect(result).toEqual([]);
	});

	test('multiple --', () => {
		const result = to_raw_rest_args(['node', 'gro', 'test', '--', 'foo', '--', 'bar']);
		expect(result).toEqual(['--', 'foo', '--', 'bar']);
	});

	test('only --', () => {
		const result = to_raw_rest_args(['node', 'gro', 'test', '--']);
		expect(result).toEqual(['--']);
	});

	test('args before -- ignored', () => {
		const result = to_raw_rest_args(['node', 'gro', 'test', '--watch', '--', '--coverage']);
		expect(result).toEqual(['--', '--coverage']);
	});
});

describe('integration: round-trip parsing', () => {
	test('serialize and parse produces same args', () => {
		// Note: false boolean values cannot round-trip (--flag is always true in mri)
		const original = {_: ['foo', 'bar'], watch: true, count: 3};
		const serialized = serialize_args(original);
		const reparsed = mri(serialized);
		expect(reparsed).toEqual(original);
	});

	test('complex args round-trip', () => {
		const original = {_: ['a', 'b'], flag: ['x', 'y', 'z'], w: true, count: 42};
		const serialized = serialize_args(original);
		const reparsed = mri(serialized);
		expect(reparsed).toEqual(original);
	});
});
