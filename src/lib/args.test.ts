import {describe, test, expect} from 'vitest';
import mri from 'mri';

import {
	serialize_args,
	to_forwarded_args,
	to_forwarded_args_by_command,
	to_raw_rest_args,
} from './args.ts';

describe('serialize_args', () => {
	test('basic behavior', () => {
		const raw = ['a', '-i', '1', 'b', 'c', '-i', '-i', 'three'];
		const parsed = mri(raw);
		expect(parsed).toEqual({_: ['a', 'b', 'c'], i: [1, true, 'three']});
		const serialized = serialize_args(parsed);
		expect(serialized).toEqual(['a', 'b', 'c', '-i', '1', '-i', '-i', 'three']); // sorted
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
});
