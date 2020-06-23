import {test, t} from '../oki/oki.js';
import {mapsEqual, sortMap} from './map.js';

test('mapsEqual()', () => {
	test('number keys', () => {
		t.ok(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
			),
		);
	});
	test('different order', () => {
		t.ok(
			!mapsEqual(
				new Map([
					['a', 1],
					['b', 2],
					['c', 3],
				]),
				new Map([
					['b', 2],
					['c', 3],
					['a', 1],
				]),
			),
		);
	});
	test('empty', () => {
		t.ok(
			!mapsEqual(
				new Map([
					['a', 1],
					['b', 2],
					['c', 3],
				]),
				new Map(),
			),
		);
	});
	test('different value', () => {
		t.ok(
			!mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'd'],
				]),
			),
		);
	});
	test('different key', () => {
		t.ok(
			!mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[1, 'a'],
					[2, 'b'],
					[4, 'c'],
				]),
			),
		);
	});
	test('more elements', () => {
		t.ok(
			!mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
					[4, 'd'],
				]),
			),
		);
	});
	test('fewer elements', () => {
		t.ok(
			!mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[1, 'a'],
					[2, 'b'],
				]),
			),
		);
	});
	test('deep equal', () => {
		t.ok(
			mapsEqual(
				new Map([
					[['a'], [{a: 1, b: 2}]],
					[['b'], {b: 2}],
					[['c'], {c: 3}],
				]),
				new Map([
					[['a'], [{a: 1, b: 2}]],
					[['b'], {b: 2}],
					[['c'], {c: 3}],
				]),
			),
		);
	});
	test('not deep equal', () => {
		t.ok(
			!mapsEqual(
				new Map([
					['a', [{a: 1, b: 2}]],
					['b', {b: 2}],
					['c', {c: 3}],
				]),
				new Map([
					['a', [{a: 1, b: 2}]],
					['b', {b: 2}],
					['c', {c: 444444444444444}],
				]),
			),
		);
	});
});

test('sortMap()', () => {
	t.equal(
		sortMap(
			new Map([
				['d', 1],
				['a', 1],
				['c', 1],
				['b', 1],
			]),
		),
		new Map([
			['a', 1],
			['b', 1],
			['c', 1],
			['d', 1],
		]),
	);

	test('custom comparator', () => {
		t.equal(
			sortMap(
				new Map([
					['d', 1],
					['a', 1],
					['c', 1],
					['b', 1],
				]),
				(a, b) => (a[0] > b[0] ? -1 : 1),
			),
			new Map([
				['d', 1],
				['c', 1],
				['b', 1],
				['a', 1],
			]),
		);
	});
});
