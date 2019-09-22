import {test} from '../oki';
import {mix, round} from './mathUtils';

test('mix()', t => {
	test('mixes two numbers', () => {
		t.is(mix(0, 10, 0.2), 2);
	});
	test('finds the midpoint between two numbers', () => {
		t.is(mix(1, 3, 0.5), 2);
	});
	test('mixes with 0', () => {
		t.is(mix(1, 3, 0), 1);
	});
	test('mixes with 1', () => {
		t.is(mix(1, 3, 1), 3);
	});
});

test('round()', t => {
	test('rounds a number up to 3 decimals', () => {
		t.is(round(0.0349, 3), 0.035);
	});
	test('rounds a negative number down to 5 decimals', () => {
		t.is(round(-1.6180339, 5), -1.61803);
	});
});
