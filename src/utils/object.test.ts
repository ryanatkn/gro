import {test, t} from '../oki/oki.js';
import {mapRecord, omit, pickBy, omitUndefined, reorder} from './object.js';

test('mapRecord', () => {
	t.equal(
		mapRecord({a: 1, b: 2}, (v, k) => v + k),
		{a: '1a', b: '2b'},
	);
	t.equal(
		mapRecord({}, (v, k) => v + k),
		{},
	);
});

test('omit', () => {
	t.equal(omit({a: 1, b: 2}, ['b']), {a: 1});
	t.equal(omit({a: 1, b: 2}, []), {a: 1, b: 2});
	t.equal(omit({a: 1, b: 2}, ['b', 'a']), {});
});

test('pickBy', () => {
	t.equal(
		pickBy({a: 1, b: 2}, (v) => v === 1),
		{a: 1},
	);
	t.equal(
		pickBy({a: 1, b: 2}, (_v, k) => k === 'a'),
		{a: 1},
	);
	t.equal(
		pickBy({a: 1, b: 2}, () => false),
		{},
	);
	t.equal(
		pickBy({a: 1, b: 2}, () => true),
		{a: 1, b: 2},
	);
});

test('omitUndefined', () => {
	t.equal(omitUndefined({a: 1, b: undefined, c: undefined}), {a: 1});
	t.equal(omitUndefined({a: undefined, b: 2, c: undefined}), {b: 2});
	t.equal(omitUndefined({a: 1, b: 2}), {a: 1, b: 2});
	t.equal(omitUndefined({a: undefined, b: undefined}), {} as any);
	t.equal(omitUndefined({}), {});
});

test('reorder', () => {
	t.is(
		JSON.stringify(reorder({a: 1, b: 2, c: 3, d: 4}, ['d', 'b', 'c', 'a'])),
		JSON.stringify({d: 4, b: 2, c: 3, a: 1}),
	);
});
