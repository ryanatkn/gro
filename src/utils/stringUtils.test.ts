import {test} from '../oki';
import {plural} from './stringUtils';

test('plural()', t => {
	test('pluralizes 0', () => {
		t.is(plural(0), 's');
	});
	test('pluralizes a positive float', () => {
		t.is(plural(45.8), 's');
	});
	test('pluralizes a negative number', () => {
		t.is(plural(-3), 's');
	});
	test('does not pluralize 1', () => {
		t.is(plural(1), '');
	});
});
