import {test, t} from '../oki/oki.js';
import {getJsonType} from './json.js';

test('getJsonType()', () => {
	t.is(getJsonType(''), 'string');
	t.is(getJsonType('1'), 'string');
	t.is(getJsonType(1), 'number');
	t.is(getJsonType(NaN), 'number');
	t.is(getJsonType(Infinity), 'number');
	t.is(getJsonType(false), 'boolean');
	t.is(getJsonType({}), 'object');
	t.is(getJsonType(null), 'null');
	t.is(getJsonType([]), 'array');
	t.throws(() => getJsonType(undefined as any));
	t.throws(() => getJsonType((() => {}) as any));
	t.throws(() => getJsonType(BigInt(9000) as any));
	t.throws(() => getJsonType(Symbol() as any));
});
