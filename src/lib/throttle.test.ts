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

// test('throttles calls to a function with leading=false', async () => {
// 	const results: string[] = [];
// 	const fn = throttle(
// 		async (name: string) => {
// 			results.push(name + '_run');
// 			await wait(10);
// 			results.push(name + '_done');
// 		},
// 		50,
// 		false,
// 	);

// 	const promise_a = fn('a');
// 	const promise_b = fn('b'); // deferred
// 	const promise_c = fn('c'); // deferred

// 	assert.equal(results, [], 'No immediate execution due to leading=false');

// 	await wait(60); // Wait for the delay to pass

// 	assert.equal(results, [], 'First call not yet executed after initial delay');

// 	await promise_a;

// 	assert.equal(results, ['a_run', 'a_done'], 'First call completed after being triggered');

// 	const promise_d = fn('d');

// 	assert.equal(results, ['a_run', 'a_done'], 'Next call not immediately executed');

// 	await wait(60); // Wait for the delay again

// 	assert.equal(results, ['a_run', 'a_done'], 'Next call not yet executed after delay');

// 	await promise_d;

// 	assert.equal(results, ['a_run', 'a_done', 'd_run', 'd_done'], 'All calls completed');

// 	assert.is(promise_b, promise_c, 'Intermediate calls return the same promise');
// 	assert.ok(promise_a !== promise_b, 'Different execution cycles return different promises');
// 	assert.ok(promise_c !== promise_d, 'Different execution cycles return different promises');
// });

test.run();
