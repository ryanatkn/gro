import {test, t} from '../oki/oki.js';
import {setsEqual} from './set.js';

test('setsEqual', () => {
	t.ok(setsEqual(new Set([1, 2, 3]), new Set([1, 2, 3])));
	test('different order with numbers', () => {
		t.ok(setsEqual(new Set([1, 2, 3]), new Set([2, 3, 1])));
	});
	test('different order with strings', () => {
		t.ok(setsEqual(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'a'])));
	});
	test('empty', () => {
		t.ok(!setsEqual(new Set([1, 2, 3]), new Set()));
	});
	test('different value', () => {
		t.ok(!setsEqual(new Set([1, 2, 3]), new Set([1, 2, 4])));
	});
	test('more elements', () => {
		t.ok(!setsEqual(new Set([1, 2, 3]), new Set([1, 2, 3, 4])));
	});
	test('fewer elements', () => {
		t.ok(!setsEqual(new Set([1, 2, 3]), new Set([1, 2])));
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
		t.ok(
			!setsEqual(
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 2])]),
				new Set(['a', 'b', [{a: 1, b: 2}], new Set([1, 3])]),
			),
		);
	});
});
