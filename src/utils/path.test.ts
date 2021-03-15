import {test, t} from '../oki/oki.js';
import {replaceExtension, toPathStem, toPathParts, toPathSegments} from './path.js';

test('replaceExtension', () => {
	t.is(replaceExtension('foo.ts', '.js'), 'foo.js');
	t.is(replaceExtension('foo.ts', ''), 'foo');
	t.is(replaceExtension('foo.ts', 'js'), 'foojs');
	t.is(replaceExtension('foo', '.js'), 'foo.js');
});

test('toPathStem', () => {
	t.is(toPathStem('foo.ts'), 'foo');
	t.is(toPathStem('foo'), 'foo');
	t.is(toPathStem('/absolute/bar/foo.ts'), 'foo');
	t.is(toPathStem('./relative/bar/foo.ts'), 'foo');
	t.is(toPathStem('relative/bar/foo.ts'), 'foo');
});

test('toPathSegments()', () => {
	t.equal(toPathSegments('foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	test('leading dot', () => {
		t.equal(toPathSegments('./foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	});
	test('leading two dots', () => {
		t.equal(toPathSegments('../../foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	});
	test('leading slash', () => {
		t.equal(toPathSegments('/foo/bar/baz.ts'), ['foo', 'bar', 'baz.ts']);
	});
	test('trailing slash', () => {
		t.equal(toPathSegments('foo/bar/baz/'), ['foo', 'bar', 'baz']);
	});
});

test('toPathParts()', () => {
	t.equal(toPathParts('foo/bar/baz.ts'), ['foo', 'foo/bar', 'foo/bar/baz.ts']);
	test('leading dot', () => {
		t.equal(toPathParts('./foo/bar/baz.ts'), ['foo', 'foo/bar', 'foo/bar/baz.ts']);
	});
	test('leading slash', () => {
		t.equal(toPathParts('/foo/bar/baz.ts'), ['/foo', '/foo/bar', '/foo/bar/baz.ts']);
	});
	test('trailing slash', () => {
		t.equal(toPathParts('foo/bar/baz/'), ['foo', 'foo/bar', 'foo/bar/baz']);
	});
});
