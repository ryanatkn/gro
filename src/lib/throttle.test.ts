import {wait} from '@ryanatkn/belt/async.js';
import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {throttle} from './throttle.js';

test('throttles calls to a function', async () => {
	const results: string[] = [];
	const fn = throttle(async (name: string) => {
		results.push(name + '_run');
		await wait();
		results.push(name + '_done');
	}, 0);

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

	await wait();

	assert.equal(results, ['a_run', 'a_done', 'd_run']);

	await promise_b;

	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done']);
});

test('calls functions in sequence', async () => {
	const results: string[] = [];
	const fn = throttle(async (name: string) => {
		results.push(name + '_run');
		await wait();
		results.push(name + '_done');
	}, 0);

	const promise_a = fn('a');

	assert.equal(results, ['a_run']);

	await promise_a;

	assert.equal(results, ['a_run', 'a_done']);

	const promise_b = fn('b');

	assert.ok(promise_a !== promise_b);

	await promise_b;

	assert.equal(results, ['a_run', 'a_done', 'b_run', 'b_done']);
});

test('throttles calls to a function with leading = false', async () => {
	const results: string[] = [];
	const fn = throttle(
		async (name: string) => {
			results.push(name + '_run');
			await wait();
			results.push(name + '_done');
		},
		0,
		false,
	);

	const promise_a = fn('a'); // discarded
	const promise_b = fn('b'); // discarded
	const promise_c = fn('c'); // discarded
	const promise_d = fn('d');

	assert.is(promise_a, promise_b);
	assert.is(promise_a, promise_c);
	assert.is(promise_a, promise_d);
	assert.equal(results, []); // No immediate execution

	await wait();

	assert.equal(results, ['d_run']);

	await promise_a; // All promises resolve to the same result

	assert.equal(results, ['d_run', 'd_done']);

	const promise_e = fn('e');
	assert.ok(promise_a !== promise_e);
	assert.equal(results, ['d_run', 'd_done']);

	await wait();

	assert.equal(results, ['d_run', 'd_done', 'e_run']);

	await promise_e;

	assert.equal(results, ['d_run', 'd_done', 'e_run', 'e_done']);

	const promise_f = fn('f'); // discarded
	const promise_g = fn('g');
	assert.ok(promise_e !== promise_f);
	assert.ok(promise_f === promise_g);
	assert.equal(results, ['d_run', 'd_done', 'e_run', 'e_done']);

	await wait();

	assert.equal(results, ['d_run', 'd_done', 'e_run', 'e_done', 'g_run']);

	await promise_g;

	assert.equal(results, ['d_run', 'd_done', 'e_run', 'e_done', 'g_run', 'g_done']);
});

test.run();
