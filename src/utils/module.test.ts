import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {is_external_module} from './module.js';

/* test_is_external_module */
const test_is_external_module = suite('is_external_module');

test_is_external_module('internal browser module patterns', () => {
	t.is(is_external_module('./foo'), false);
	t.is(is_external_module('./foo.js'), false);
	t.is(is_external_module('../foo'), false);
	t.is(is_external_module('../foo.js'), false);
	t.is(is_external_module('../../../foo'), false);
	t.is(is_external_module('../../../foo.js'), false);
	t.is(is_external_module('/foo'), false);
	t.is(is_external_module('/foo.js'), false);
	t.is(is_external_module('src/foo'), false);
	t.is(is_external_module('src/foo.js'), false);
	t.is(is_external_module('$lib/foo'), false);
	t.is(is_external_module('$lib/foo.js'), false);
	t.is(is_external_module('./foo/bar/baz'), false);
	t.is(is_external_module('./foo/bar/baz.js'), false);
	t.is(is_external_module('../foo/bar/baz'), false);
	t.is(is_external_module('../foo/bar/baz.js'), false);
	t.is(is_external_module('../../../foo/bar/baz'), false);
	t.is(is_external_module('../../../foo/bar/baz.js'), false);
	t.is(is_external_module('/foo/bar/baz'), false);
	t.is(is_external_module('/foo/bar/baz.js'), false);
	t.is(is_external_module('src/foo/bar/baz'), false);
	t.is(is_external_module('src/foo/bar/baz.js'), false);
	t.is(is_external_module('$lib/foo/bar/baz'), false);
	t.is(is_external_module('$lib/foo/bar/baz.js'), false);
});

test_is_external_module('external browser module patterns', () => {
	t.is(is_external_module('foo'), true);
	t.is(is_external_module('foo.js'), true);
	t.is(is_external_module('foo/bar/baz'), true);
	t.is(is_external_module('foo/bar/baz.js'), true);
	t.is(is_external_module('@foo/bar/baz'), true);
	t.is(is_external_module('@foo/bar/baz.js'), true);
});

test_is_external_module.run();
/* /test_is_external_module */
