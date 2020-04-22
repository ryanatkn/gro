import {test, t} from '../oki/oki.js';
import {replaceExt, hasExt, getPathStem} from './path.js';

test('replaceExt', () => {
	t.is(replaceExt('foo.ts', '.js'), 'foo.js');
	t.is(replaceExt('foo.ts', ''), 'foo');
	t.is(replaceExt('foo.ts', 'js'), 'foojs');
	t.is(replaceExt('foo', '.js'), 'foo.js');
});

test('hasExt', () => {
	t.ok(hasExt('foo.ts', ['.ts']));
	t.ok(hasExt('foo.svelte', ['.ts', '.svelte']));
	t.ok(!hasExt('foo.js', ['.ts', '.svelte']));
	t.ok(!hasExt('foo.js', ['js']));
});

test('getPathStem', () => {
	t.is(getPathStem('foo.ts'), 'foo');
	t.is(getPathStem('foo'), 'foo');
	t.is(getPathStem('/absolute/bar/foo.ts'), 'foo');
	t.is(getPathStem('./relative/bar/foo.ts'), 'foo');
	t.is(getPathStem('relative/bar/foo.ts'), 'foo');
});
