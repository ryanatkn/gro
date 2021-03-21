import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {last, ensureArray} from './array.js';

/* test_last */
const test_last = suite('last');

test_last('basic behavior', () => {
	t.is(last([1, 2]), 2);
	t.is(last([1]), 1);
	t.is(last([]), undefined);
});

test_last.run();
/* /test_last */

/* test_ensureArray */
const test_ensureArray = suite('ensureArray');

test_ensureArray('basic behavior', () => {
	const array = [1, 2, 3];
	t.is(array, ensureArray(array));
	t.equal([1], ensureArray(1));
	t.equal([{a: 1}], ensureArray({a: 1}));
});

test_ensureArray.run();
/* /test_ensureArray */
