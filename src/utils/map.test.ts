import {test, t} from '../oki/oki.js';
import {sortMap} from './map.js';

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
