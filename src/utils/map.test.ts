import {test, t} from '../oki/oki.js';
import {mapsEqual} from './map.js';

test('mapsEqual', () => {
	test('number keys', () => {
		t.ok(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[2, 'b'],
					[3, 'c'],
					[1, 'a'],
				]),
			),
		);
	});
	test('string keys', () => {
		t.ok(
			mapsEqual(
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
		t.notOk(
			mapsEqual(
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
		t.notOk(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[2, 'b'],
					[3, 'd'],
					[1, 'a'],
				]),
			),
		);
	});
	test('different key', () => {
		t.notOk(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[2, 'b'],
					[4, 'c'],
					[1, 'a'],
				]),
			),
		);
	});
	test('more elements', () => {
		t.notOk(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[2, 'b'],
					[3, 'c'],
					[1, 'a'],
					[4, 'd'],
				]),
			),
		);
	});
	test('fewer elements', () => {
		t.notOk(
			mapsEqual(
				new Map([
					[1, 'a'],
					[2, 'b'],
					[3, 'c'],
				]),
				new Map([
					[2, 'b'],
					[1, 'a'],
				]),
			),
		);
	});
	test('deep equal', () => {
		t.ok(
			mapsEqual(
				new Map([
					['a', [{a: 1, b: 2}]],
					['b', {b: 2}],
					['c', {c: 3}],
				]),
				new Map([
					['b', {b: 2}],
					['c', {c: 3}],
					['a', [{a: 1, b: 2}]],
				]),
			),
		);
	});
	test('not deep equal', () => {
		t.notOk(
			mapsEqual(
				new Map([
					['a', [{a: 1, b: 2}]],
					['b', {b: 2}],
					['c', {c: 3}],
				]),
				new Map([
					['b', {b: 2}],
					['c', {c: 4}],
					['a', [{a: 1, b: 2}]],
				]),
			),
		);
	});
});
