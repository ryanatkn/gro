import {test} from '../oki';
import {plural} from './stringUtils';

test('pluralizes 0', t => {
	t.equal(plural(0), 's');
});

test('pluralizes a positive float', t => {
	t.equal(plural(45.8), 's');
});

test('pluralizes a negative number', t => {
	t.equal(plural(-3), 's');
});

test('does not pluralize 1', t => {
	t.equal(plural(1), '');
});
