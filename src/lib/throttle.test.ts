import {wait} from '@feltjs/util/async.js';
import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {throttle} from './throttle.js';

test('throttles calls to a function', async () => {
	const results: string[] = [];
	const fn = throttle(async (name: string) => {
		results.push(name + '_run');
		await wait();
		results.push(name + '_done');
	});
	const promise_a = fn('a');
	const promise_b = fn('b'); // discarded
	const promise_c = fn('c'); // discarded
	const promise_d = fn('d');
	assert.ok(promise_a !== promise_b);
	assert.is(promise_b, promise_c);
	assert.is(promise_b, promise_d);
	assert.equal(results, ['a_run']);
	await promise_a;
	assert.equal(results, ['a_run', 'a_done']);
	await promise_b;
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done']);
	const promise_e = fn('e'); // discarded
	const promise_f = fn('f');
	assert.ok(promise_d !== promise_e);
	assert.is(promise_e, promise_f);
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done']); // delayed
	await wait();
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done', 'f_run']);
	await promise_e;
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done', 'f_run', 'f_done']);
	const promise_g = fn('g');
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done', 'f_run', 'f_done']); // delayed
	await wait();
	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done', 'f_run', 'f_done', 'g_run']);
	await promise_g;
	assert.equal(results, [
		'a_run',
		'a_done',
		'd_run',
		'd_done',
		'f_run',
		'f_done',
		'g_run',
		'g_done',
	]);
});

test.run();
