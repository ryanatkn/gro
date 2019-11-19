import {test} from '../oki/index.js';
import {setsEqual} from './set.js';

test('setsEqual', t => {
	t.ok(setsEqual(new Set([1, 2, 3]), new Set([1, 2, 3])));
	test('different order with numbers', () => {
		t.ok(setsEqual(new Set([1, 2, 3]), new Set([2, 3, 1])));
	});
	test('different order with strings', () => {
		t.ok(setsEqual(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'a'])));
	});
	test('empty', () => {
		t.notOk(setsEqual(new Set([1, 2, 3]), new Set()));
	});
	test('different value', () => {
		t.notOk(setsEqual(new Set([1, 2, 3]), new Set([1, 2, 4])));
	});
	test('more elements', () => {
		t.notOk(setsEqual(new Set([1, 2, 3]), new Set([1, 2, 3, 4])));
	});
	test('fewer elements', () => {
		t.notOk(setsEqual(new Set([1, 2, 3]), new Set([1, 2])));
	});
	test('deep equal', () => {
		t.ok(
			setsEqual(
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 2])]),
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 2])]),
			),
		);
	});
	test('not deep equal', () => {
		t.notOk(
			setsEqual(
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 2])]),
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 3])]),
			),
		);
	});
});
