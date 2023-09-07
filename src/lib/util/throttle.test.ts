import {wait} from '@feltjs/util/async.js';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {throttle} from './throttle.js';

/* test__throttle */
const test__throttle = suite('throttle');

test__throttle('throttles all calls', async () => {
	const results: string[] = [];
	const fn = throttle(async (name: string) => {
		results.push(name + '_run');
		await wait();
		results.push(name + '_done');
	});
	const promise_a = fn('a');
	const promise_b = fn('b');
	assert.equal(results, ['a_run']);
	await promise_a;
	assert.equal(results, ['a_run', 'a_done']);
	await promise_b;
	assert.equal(results, ['a_run', 'a_done', 'b_run', 'b_done']);
});

test__throttle('discards all but one concurrent call', async () => {
	const results: string[] = [];
	const fn = throttle(
		async (a: string, _b: number, c: string) => {
			results.push(a + c + '_run');
			await wait();
			results.push(a + c + '_done');
		},
		(a, b) => a + b,
	);
	const promise_a1 = fn('a', 0, '1');
	const promise_a2 = fn('a', 0, '2'); // discarded
	const promise_a3 = fn('a', 0, '3'); // discarded
	const promise_b1 = fn('b', 0, '1'); // not discarded because it has a different key
	const promise_a4 = fn('a', 0, '4');
	assert.equal(results, ['a1_run', 'b1_run']);
	await promise_a1;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done']);
	await promise_b1;
	await promise_a2;
	await promise_a3;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done']);
	await promise_a4;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done', 'a4_done']);
	// run once more just to ensure nothing is off
	results.length = 0;
	const promise_a1b = fn('a', 0, '1');
	await promise_a1b;
	const promise_b1b = fn('b', 0, '1');
	await promise_b1b;
	assert.equal(results, ['a1_run', 'a1_done', 'b1_run', 'b1_done']);
});

test__throttle('throttles with a delay', async () => {
	const results: string[] = [];
	const fn = throttle(
		async (a: string, _b: number, c: string) => {
			results.push(a + c + '_run');
			await wait();
			results.push(a + c + '_done');
		},
		(a, b) => a + b,
		1,
	);
	const promise1 = fn('a', 0, '1');
	assert.equal(results, ['a1_run']);
	await promise1;
	assert.equal(results, ['a1_run', 'a1_done']);
	const promise2 = fn('a', 0, '2');
	assert.equal(results, ['a1_run', 'a1_done']); // due to the delay, this does not have 'a2_run'
	await promise2;
	assert.equal(results, ['a1_run', 'a1_done', 'a2_run', 'a2_done']);
});

test__throttle.run();
/* test__throttle */
