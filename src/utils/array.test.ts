import {test, t} from '../oki/oki.js';

import {last, ensureArray} from './array.js';

test('last()', () => {
	t.is(last([1, 2]), 2);
	t.is(last([1]), 1);
	t.is(last([]), undefined);
});

test('ensureArray()', () => {
	const array = [1, 2, 3];
	t.is(array, ensureArray(array));
	t.equal([1], ensureArray(1));
	t.equal([{a: 1}], ensureArray({a: 1}));
});
