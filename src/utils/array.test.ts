import {test, t} from '../oki/oki.js';

import {last, arraysEqual} from './array.js';

test('last', () => {
	t.is(last([1, 2]), 2);
	t.is(last([1]), 1);
	t.is(last([]), undefined);
});

test('arraysEqual', () => {
	t.ok(arraysEqual([1, 2, 3], [1, 2, 3]));
	test('different order', () => {
		t.notOk(arraysEqual([1, 2, 3], [1, 3, 2]));
	});
	test('one is empty', () => {
		t.notOk(arraysEqual([1, 2, 3], []));
	});
	test('more elements', () => {
		t.notOk(arraysEqual([1, 2, 3], [1, 2, 3, 4]));
	});
	test('fewer elements', () => {
		t.notOk(arraysEqual([1, 2, 3], [1, 2]));
	});
	test('deep equal', () => {
		t.ok(
			arraysEqual(
				[1, {a: 2}, {a: {b: {c: 3, d: NaN}}}],
				[1, {a: 2}, {a: {b: {c: 3, d: NaN}}}],
			),
		);
	});
	test('not deep equal', () => {
		t.notOk(
			arraysEqual(
				[1, {a: 2}, {a: {b: {c: 3, d: NaN}}}],
				[1, {a: 2}, {a: {b: {c: 4, d: NaN}}}],
			),
		);
	});
});
