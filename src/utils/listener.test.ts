import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {addListener, callListeners} from './listener.js';
import type {Listener} from './listener.js';
import {noop} from './function.js';

/* test_addListener */
const test_addListener = suite('addListener');

test_addListener('basic behavior', () => {
	const obj: {k: null | Set<Listener>} = {k: null};
	const key = 'k';
	const remove1 = addListener(obj, key, () => {});
	const remove2 = addListener(obj, key, noop);
	const remove3 = addListener(obj, key, noop);
	const remove4 = addListener(obj, key, noop);
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

test_addListener.run();
/* /test_addListener */

/* test_callListeners */
const test_callListeners = suite('callListeners');

test_callListeners('basic behavior', () => {
	const obj: {k: undefined | ((x: number, y?: number) => void)} = {k: undefined};
	const key = 'k';
	let count = 0;
	callListeners(obj, key, [2, 3]);
	const remove1 = addListener(obj, key, (x, y = 0) => (count += x + y));
	const remove2 = addListener(obj, key, (x, y = 0) => (count += x + y));
	const remove3 = addListener(obj, key, (x, y = 0) => (count += x + y));
	callListeners(obj, key, [2, 3]);
	t.is(count, 15);
	callListeners(obj, key, [1]);
	t.is(count, 18);
	remove1();
	remove2();
	callListeners(obj, key, [1]);
	t.is(count, 19);
	remove3();
	callListeners(obj, key, [1]);
	t.is(count, 19);
	remove3();
	remove3();
	remove3();
	callListeners(obj, key, [1]);
	callListeners(obj, key, [1]);
	callListeners(obj, key, [1]);
	t.is(count, 19);
});

test_callListeners.run();
/* /test_callListeners */
