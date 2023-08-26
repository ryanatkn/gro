import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {toHash} from './helpers.js';

/* test__toHash */
const test__toHash = suite('toHash');

test__toHash('turns a buffer into a string', () => {
	assert.type(toHash(Buffer.from('hey')), 'string');
});

test__toHash('returns the same value given the same input', () => {
	assert.is(toHash(Buffer.from('hey')), toHash(Buffer.from('hey')));
});

test__toHash.run();
/* test__toHash */
