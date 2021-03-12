import {test, t} from '../oki/oki.js';
import {replaceExtension, toPathStem} from './path.js';

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
