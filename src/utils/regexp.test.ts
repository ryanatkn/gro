import {test, t} from '../oki/oki.js';
import {regexpsEqual} from './regexp.js';

test('regexpsEqual', () => {
	t.ok(regexpsEqual(new RegExp('a'), new RegExp('a')));
	t.ok(regexpsEqual(new RegExp('a'), /a/));
	t.ok(regexpsEqual(/a/, /a/));
	test('different source', () => {
		t.ok(!regexpsEqual(new RegExp('a'), new RegExp('b')));
		t.ok(!regexpsEqual(new RegExp('a'), /b/));
		t.ok(!regexpsEqual(/a/, /b/));
	});
	test('different flags', () => {
		t.ok(!regexpsEqual(new RegExp('a'), new RegExp('a', 'g')));
		t.ok(!regexpsEqual(new RegExp('a'), /a/g));
		t.ok(!regexpsEqual(/a/, /a/g));
	});
});
