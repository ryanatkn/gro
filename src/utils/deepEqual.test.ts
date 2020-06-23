import {test, t} from '../oki/oki.js';
import {deepEqual} from '../utils/deepEqual.js';

test('deepEqual()', () => {
	const symbol = Symbol();
	const fn = () => {};
	const equalValues: readonly [string, any, any][] = [
		['numbers', 1, 1],
		['NaN', NaN, NaN],
		['true', true, true],
		['false', false, false],
		['strings', 'hi', 'hi'],
		['symbols', symbol, symbol],
		['null', null, null],
		['undefined and void 0', undefined, void 0],
		['functions', fn, fn],
		['arrays', [1, 'a'], [1, 'a']],
		['empty arrays', [], []],
		['nested arrays', [1, [[[[1, 'd'], 'c'], 'b'], 'a']], [1, [[[[1, 'd'], 'c'], 'b'], 'a']]],
		['typed arrays', new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
		['objects', {a: 1, b: 2}, {a: 1, b: 2}],
		['objects with shuffled keys', {a: 1, b: 2}, {b: 2, a: 1}],
		[
			'complex objects',
			{a: 1, b: {c: {d: {e: 1, f: {g: {h1: 1, h2: 2}, i: 1}}}, j: 1}},
			{a: 1, b: {c: {d: {e: 1, f: {g: {h2: 2, h1: 1}, i: 1}}}, j: 1}},
		],
		['sets', new Set(['a', 'b', null, Array, 1, 2, 3]), new Set(['a', 'b', null, Array, 1, 2, 3])],
		[
			'sets with shuffled order',
			new Set(['a', 'b', null, Array, 1, 2, 3]),
			new Set(['b', 'a', null, 3, 2, 1, Array]),
		],
		[
			'maps',
			new Map<string, any>([
				['a', 1],
				['b', 2],
				['c', [1, [2, 3]]],
			]),
			new Map<string, any>([
				['a', 1],
				['b', 2],
				['c', [1, [2, 3]]],
			]),
		],
		['regexps', /a/, /a/],
	];

	equalValues.forEach(([message, a, b]) => {
		test(message, () => {
			t.ok(deepEqual(a, b));
		});
		test(message + ' ↶', () => {
			t.ok(deepEqual(b, a));
		});
	});
});

test('!deepEqual()', () => {
	const unequalValues: readonly [string, any, any][] = [
		['numbers with different signs', 1, -1],
		['number and NaN', 0, NaN],
		['positive and negative infinity', Infinity, -Infinity],
		['positive and negative zero', 0, -0],
		['booleans', true, false],
		['strings', 'hi', 'hh'],
		['symbols', Symbol(), Symbol()],
		['null and undefined', null, undefined],
		['functions', () => {}, () => {}],
		['arrays with different elements', [1, 'a'], [1]],
		['empty array and array with undefined', [], [undefined]],
		['arrays with differently sorted elements', [1, 'a'], ['a', 1]],
		['arrays with different types', [1, 2, 3], [1, '2', 3]],
		['nested arrays', [1, [[[[1, 'd'], 'c'], 'b'], 'a']], [1, [[[[1, 'D'], 'c'], 'b'], 'a']]],
		[
			'typed arrays with differently sorted elements',
			new Uint8Array([1, 2, 3]),
			new Uint8Array([1, 3, 2]),
		],
		['objects with different key counts', {a: 1}, {a: 1, b: 2}],
		['objects with differently named keys', {a: 1, b: 2}, {a: 1, c: 2}],
		['objects with different values', {a: 1, b: 2}, {a: 1, b: 3}],
		['object and null', {}, null],
		['object and undefined', {}, undefined],
		[
			'complex objects',
			{a: 1, b: {c: {d: {e: 1, f: {g: {h1: 1, h2: 2}, i: 1}}}, j: 1}},
			{a: 1, b: {c: {d: {e: 1, f: {g: {h2: 3, h1: 1}, i: 1}}}, j: 1}},
		],
		['sets with different values', new Set(['a', 'b', null, 1]), new Set(['a', 'b', null, '1'])],
		['sets with equivalent arrays', new Set(['a', 'b', 'c', 'd']), ['a', 'b', 'c', 'd']],
		[
			'maps with different values',
			new Map([
				['a', 1],
				['b', 2],
				['c', 3],
			]),
			new Map([
				['a', 1],
				['b', 2],
				['c', 4],
			]),
		],
		[
			'maps with different keys',
			new Map([
				['a', 1],
				['b', 2],
				['c', 3],
			]),
			new Map([
				['a', 1],
				['b', 2],
				['d', 3],
			]),
		],
		[
			'maps with fewer pairs',
			new Map([
				['a', 1],
				['b', 2],
				['c', 3],
			]),
			new Map([
				['a', 1],
				['b', 2],
			]),
		],
		[
			'maps with equivalent objects',
			new Map([
				['a', 1],
				['b', 2],
				['c', 3],
			]),
			{a: 1, b: 2, c: 3},
		],
		['regexps with different sources', /a/, /b/],
		['regexps with different flags', /a/, /a/g],
	];

	unequalValues.forEach(([message, a, b]) => {
		test(message, () => {
			t.ok(!deepEqual(a, b));
		});
		test(message + ' ↶', () => {
			t.ok(!deepEqual(b, a));
		});
	});
});
