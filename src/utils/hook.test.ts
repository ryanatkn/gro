import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {addHook, callHooks} from './hook.js';
import type {Hook} from './hook.js';
import {noop} from './function.js';

/* test_addHook */
const test_addHook = suite('addHook');

test_addHook('basic behavior', () => {
	const obj: {k: null | Set<Hook>} = {k: null};
	const key = 'k';
	const remove1 = addHook(obj, key, () => {});
	const remove2 = addHook(obj, key, noop);
	const remove3 = addHook(obj, key, noop);
	const remove4 = addHook(obj, key, noop);
	const k = obj[key];
	t.ok(k);
	t.instance(k, Set);
	t.is(k.size, 2);
	remove1();
	t.is(k.size, 1);
	remove2();
	t.is(k.size, 0);
	remove3();
	remove4();
	t.is(k.size, 0);
});

test_addHook.run();
/* /test_addHook */

/* test_callHooks */
const test_callHooks = suite('callHooks');

test_callHooks('basic behavior', () => {
	const obj: {k: undefined | ((x: number, y?: number) => void)} = {k: undefined};
	const key = 'k';
	let count = 0;
	callHooks(obj, key, [2, 3]);
	const remove1 = addHook(obj, key, (x, y = 0) => (count += x + y));
	const remove2 = addHook(obj, key, (x, y = 0) => (count += x + y));
	const remove3 = addHook(obj, key, (x, y = 0) => (count += x + y));
	callHooks(obj, key, [2, 3]);
	t.is(count, 15);
	callHooks(obj, key, [1]);
	t.is(count, 18);
	remove1();
	remove2();
	callHooks(obj, key, [1]);
	t.is(count, 19);
	remove3();
	callHooks(obj, key, [1]);
	t.is(count, 19);
	remove3();
	remove3();
	remove3();
});

test_callHooks.run();
/* /test_callHooks */
