import {test} from '../oki/index.js';
import {
	plural,
	truncate,
	stripStart,
	stripEnd,
	stripAfter,
	stripBefore,
	ensureStart,
	ensureEnd,
	deindent,
} from './stringUtils.js';

test('truncate()', t => {
	t.is(truncate('foobarbaz', 5), 'fo...');
	test('no truncation needed', () => {
		t.is(truncate('foobarbaz', 9), 'foobarbaz');
	});
	test('custom suffix', () => {
		t.is(truncate('foobarbaz', 5, '-'), 'foob-');
	});
	test('no suffix', () => {
		t.is(truncate('foobarbaz', 5, ''), 'fooba');
	});
	test('zero length', () => {
		t.is(truncate('foobarbaz', 0), '');
	});
	test('zero length and no suffix', () => {
		t.is(truncate('foobarbaz', 0, ''), '');
	});
	test('negative length', () => {
		t.is(truncate('foobarbaz', -5), '');
	});
	test('length equal to suffix', () => {
		t.is(truncate('foobarbaz', 2, '..'), '..');
	});
	test('length shorter than suffix returns empty string', () => {
		t.is(truncate('foobarbaz', 2, '...'), '');
	});
});

test('stripStart()', t => {
	t.is(stripStart('foobar', 'foo'), 'bar');
	test('single character', () => {
		t.is(stripStart('foobar', 'f'), 'oobar');
	});
	test('single character of multiple', () => {
		t.is(stripStart('ffoobar', 'f'), 'foobar');
	});
	test('noop for partial match', () => {
		t.is(stripStart('foobar', 'fob'), 'foobar');
	});
	test('noop for matching end but not start', () => {
		t.is(stripStart('foobar', 'bar'), 'foobar');
	});
	test('noop for empty string', () => {
		t.is(stripStart('foobar', ''), 'foobar');
	});
});

test('stripEnd()', t => {
	t.is(stripEnd('foobar', 'bar'), 'foo');
	test('single character', () => {
		t.is(stripEnd('foobar', 'r'), 'fooba');
	});
	test('single character of multiple', () => {
		t.is(stripEnd('foobarr', 'r'), 'foobar');
	});
	test('noop for partial match', () => {
		t.is(stripEnd('foobar', 'oar'), 'foobar');
	});
	test('noop for matching start but not end', () => {
		t.is(stripEnd('foobar', 'foo'), 'foobar');
	});
	test('noop for empty string', () => {
		t.is(stripEnd('foobar', ''), 'foobar');
	});
});

test('stripAfter()', t => {
	t.is(stripAfter('foobar', 'oo'), 'f');
	test('starting characters', () => {
		t.is(stripAfter('foobar', 'foo'), '');
	});
	test('ending characters', () => {
		t.is(stripAfter('foobar', 'bar'), 'foo');
	});
	test('single character', () => {
		t.is(stripAfter('foobar', 'b'), 'foo');
	});
	test('first of many characters', () => {
		t.is(stripAfter('foobar', 'o'), 'f');
	});
	test('strips after first character', () => {
		t.is(stripAfter('foobar', 'f'), '');
	});
	test('strips last character', () => {
		t.is(stripAfter('foobar', 'r'), 'fooba');
	});
	test('noop for missing character', () => {
		t.is(stripAfter('foobar', 'x'), 'foobar');
	});
	test('noop for partial match', () => {
		t.is(stripAfter('foobar', 'bo'), 'foobar');
	});
	test('empty string', () => {
		t.is(stripAfter('foobar', ''), 'foobar');
	});
});

test('stripBefore()', t => {
	t.is(stripBefore('foobar', 'oo'), 'bar');
	test('starting characters', () => {
		t.is(stripBefore('foobar', 'foo'), 'bar');
	});
	test('ending characters', () => {
		t.is(stripBefore('foobar', 'bar'), '');
	});
	test('single character', () => {
		t.is(stripBefore('foobar', 'b'), 'ar');
	});
	test('first of many characters', () => {
		t.is(stripBefore('foobar', 'o'), 'obar');
	});
	test('strips after first character', () => {
		t.is(stripBefore('foobar', 'f'), 'oobar');
	});
	test('strips last character', () => {
		t.is(stripBefore('foobar', 'r'), '');
	});
	test('noop for missing character', () => {
		t.is(stripBefore('foobar', 'x'), 'foobar');
	});
	test('noop for partial match', () => {
		t.is(stripBefore('foobar', 'bo'), 'foobar');
	});
	test('empty string', () => {
		t.is(stripBefore('foobar', ''), 'foobar');
	});
});

test('ensureStart()', t => {
	t.is(ensureStart('foobar', 'food'), 'foodfoobar');
	test('existing text', () => {
		t.is(ensureStart('foobar', 'foo'), 'foobar');
	});
	test('existing character', () => {
		t.is(ensureStart('foobar', 'f'), 'foobar');
	});
	test('second character', () => {
		t.is(ensureStart('foobar', 'o'), 'ofoobar');
	});
	test('empty string', () => {
		t.is(ensureStart('foobar', ''), 'foobar');
	});
	test('whole string', () => {
		t.is(ensureStart('foobar', 'foobar'), 'foobar');
	});
	test('whole string plus a start character', () => {
		t.is(ensureStart('foobar', 'xfoobar'), 'xfoobarfoobar');
	});
	test('whole string plus an end character', () => {
		t.is(ensureStart('foobar', 'foobarx'), 'foobarxfoobar');
	});
	test('empty strings', () => {
		t.is(ensureStart('', ''), '');
	});
	test('empty source string', () => {
		t.is(ensureStart('', 'foo'), 'foo');
	});
});

test('ensureEnd()', t => {
	t.is(ensureEnd('foobar', 'abar'), 'foobarabar');
	test('existing text', () => {
		t.is(ensureEnd('foobar', 'bar'), 'foobar');
	});
	test('existing character', () => {
		t.is(ensureEnd('foobar', 'r'), 'foobar');
	});
	test('second to last character', () => {
		t.is(ensureEnd('foobar', 'a'), 'foobara');
	});
	test('empty string', () => {
		t.is(ensureEnd('foobar', ''), 'foobar');
	});
	test('whole string', () => {
		t.is(ensureEnd('foobar', 'foobar'), 'foobar');
	});
	test('whole string plus a start character', () => {
		t.is(ensureEnd('foobar', 'xfoobar'), 'foobarxfoobar');
	});
	test('whole string plus an end character', () => {
		t.is(ensureEnd('foobar', 'foobarx'), 'foobarfoobarx');
	});
	test('empty strings', () => {
		t.is(ensureEnd('', ''), '');
	});
	test('empty source string', () => {
		t.is(ensureEnd('', 'foo'), 'foo');
	});
});

test('deindent()', t => {
	t.is(
		deindent(`
      hello
      world
        - nested
          - more
        - less
	`),
		`hello
world
- nested
- more
- less
`,
	);
	test('single line', () => {
		t.is(deindent('  hey'), 'hey');
	});
	test('strips trailing spaces', () => {
		t.is(deindent('  hey  '), 'hey');
	});
});

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
