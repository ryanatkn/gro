import {wait} from '@feltcoop/felt/util/async.js';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {throttleAsync} from './throttleAsync.js';

/* test__throttleAsync */
const test__throttleAsync = suite('throttleAsync');

test__throttleAsync('throttles all calls', async () => {
	const results: string[] = [];
	const fn = throttleAsync(async (name: string) => {
		results.push(name + '_run');
		await wait();
		results.push(name + '_done');
	});
	const promiseA = fn('a');
	const promiseB = fn('b');
	assert.equal(results, ['a_run']);
	await promiseA;
	assert.equal(results, ['a_run', 'a_done']);
	await promiseB;
	assert.equal(results, ['a_run', 'a_done', 'b_run', 'b_done']);
});

test__throttleAsync('discards all but one concurrent call', async () => {
	const results: string[] = [];
	const fn = throttleAsync(
		async (a: string, _b: number, c: string) => {
			results.push(a + c + '_run');
			await wait();
			results.push(a + c + '_done');
		},
		(a, b) => a + b,
	);
	const promiseA1 = fn('a', 0, '1');
	const promiseA2 = fn('a', 0, '2'); // discarded
	const promiseA3 = fn('a', 0, '3'); // discarded
	const promiseB1 = fn('b', 0, '1'); // not discarded because it has a different key
	const promiseA4 = fn('a', 0, '4');
	assert.equal(results, ['a1_run', 'b1_run']);
	await promiseA1;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done']);
	await promiseB1;
	await promiseA2;
	await promiseA3;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done']);
	await promiseA4;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done', 'a4_done']);
	// run once more just to ensure nothing is off
	results.length = 0;
	const promiseA1b = fn('a', 0, '1');
	await promiseA1b;
	const promiseB1b = fn('b', 0, '1');
	await promiseB1b;
	assert.equal(results, ['a1_run', 'a1_done', 'b1_run', 'b1_done']);
});

test__throttleAsync('throttles with a delay', async () => {
	const results: string[] = [];
	const fn = throttleAsync(
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

test__throttleAsync.run();
/* test__throttleAsync */
