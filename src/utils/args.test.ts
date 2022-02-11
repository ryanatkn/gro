import mri from 'mri';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {serializeArgs} from './args.js';

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
