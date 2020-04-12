import {test, t} from '../oki/oki.js';
import {regexpsEqual} from './regexp.js';

test('regexpsEqual', () => {
	t.ok(regexpsEqual(new RegExp('a'), new RegExp('a')));
	t.ok(regexpsEqual(new RegExp('a'), /a/));
	t.ok(regexpsEqual(/a/, /a/));
	test('different source', () => {
		t.notOk(regexpsEqual(new RegExp('a'), new RegExp('b')));
		t.notOk(regexpsEqual(new RegExp('a'), /b/));
		t.notOk(regexpsEqual(/a/, /b/));
	});
	test('different flags', () => {
		t.notOk(regexpsEqual(new RegExp('a'), new RegExp('a', 'g')));
		t.notOk(regexpsEqual(new RegExp('a'), /a/g));
		t.notOk(regexpsEqual(/a/, /a/g));
	});
});
