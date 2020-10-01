import {test, t} from '../oki/oki.js';
import {replaceExtension, getPathStem} from './path.js';

test('replaceExtension', () => {
	t.is(replaceExtension('foo.ts', '.js'), 'foo.js');
	t.is(replaceExtension('foo.ts', ''), 'foo');
	t.is(replaceExtension('foo.ts', 'js'), 'foojs');
	t.is(replaceExtension('foo', '.js'), 'foo.js');
});

test('getPathStem', () => {
	t.is(getPathStem('foo.ts'), 'foo');
	t.is(getPathStem('foo'), 'foo');
	t.is(getPathStem('/absolute/bar/foo.ts'), 'foo');
	t.is(getPathStem('./relative/bar/foo.ts'), 'foo');
	t.is(getPathStem('relative/bar/foo.ts'), 'foo');
});
