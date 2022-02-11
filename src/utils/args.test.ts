import mri from 'mri';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {serializeArgs, toForwardedArgs, toForwardedArgsByCommand, toRawRestArgs} from './args.js';

/* test__serializeArgs */
const test__serializeArgs = suite('serializeArgs');

test__serializeArgs('basic behavior', () => {
	const raw = ['a', '-i', '1', 'b', 'c', '-i', '-i', 'three'];
	const parsed = mri(raw);
	assert.equal(parsed, {_: ['a', 'b', 'c'], i: [1, true, 'three']});
	const serialized = serializeArgs(parsed);
	assert.equal(serialized, ['a', 'b', 'c', '-i', '1', '-i', '-i', 'three']); // sorted
});

test__serializeArgs.run();
/* test__serializeArgs */

/* test__toForwardedArgsByCommand */
const test__toForwardedArgsByCommand = suite('toForwardedArgsByCommand');

test__toForwardedArgsByCommand('basic behavior', () => {
	const rawRestArgs = toRawRestArgs(
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
	assert.equal(toForwardedArgsByCommand(true, rawRestArgs), {
		eslint: {_: ['a'], b: 'c'},
		'gro a': {a: true},
		tsc: {b: true},
		'gro b': {'2': 't2a', t: true, t2: 't2b', t222: 2},
		groc: {m: true, n: 'nn'},
		'gro d': {b: 'a', c: 5},
	});
	assert.equal(toForwardedArgs('gro b', true, rawRestArgs), {
		'2': 't2a',
		t: true,
		t2: 't2b',
		t222: 2,
	});
});

test__toForwardedArgsByCommand.run();
/* test__toForwardedArgsByCommand */
