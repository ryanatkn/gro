import mri from 'mri';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {
	serialize_args,
	to_forwarded_args,
	to_forwarded_args_by_command,
	to_raw_rest_args,
} from './args.js';

/* test__serialize_args */
const test__serialize_args = suite('serialize_args');

test__serialize_args('basic behavior', () => {
	const raw = ['a', '-i', '1', 'b', 'c', '-i', '-i', 'three'];
	const parsed = mri(raw);
	assert.equal(parsed, {_: ['a', 'b', 'c'], i: [1, true, 'three']});
	const serialized = serialize_args(parsed);
	assert.equal(serialized, ['a', 'b', 'c', '-i', '1', '-i', '-i', 'three']); // sorted
});

test__serialize_args.run();
/* test__serialize_args */

/* test__to_forwarded_args_by_command */
const test__to_forwarded_args_by_command = suite('to_forwarded_args_by_command');

test__to_forwarded_args_by_command('basic behavior', () => {
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
	assert.equal(to_forwarded_args_by_command(true, raw_rest_args), {
		eslint: {_: ['a'], b: 'c'},
		'gro a': {a: true},
		tsc: {b: true},
		'gro b': {'2': 't2a', t: true, t2: 't2b', t222: 2},
		groc: {m: true, n: 'nn'},
		'gro d': {b: 'a', c: 5},
	});
	assert.equal(to_forwarded_args('gro b', true, raw_rest_args), {
		'2': 't2a',
		t: true,
		t2: 't2b',
		t222: 2,
	});
});

test__to_forwarded_args_by_command.run();
/* test__to_forwarded_args_by_command */
