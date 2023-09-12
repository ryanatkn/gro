import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {to_hash} from './hash.js';

/* test__to_hash */
const test__to_hash = suite('to_hash');

test__to_hash('turns a buffer into a string', () => {
	assert.type(to_hash(Buffer.from('hey')), 'string');
});

test__to_hash('returns the same value given the same input', () => {
	assert.is(to_hash(Buffer.from('hey')), to_hash(Buffer.from('hey')));
});

test__to_hash.run();
/* test__to_hash */
