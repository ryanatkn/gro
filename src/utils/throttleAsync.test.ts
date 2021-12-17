import {wait} from '@feltcoop/felt';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {throttleAsync} from './throttleAsync.js';

/* test__throttleAsync */
const test__throttleAsync = suite('throttleAsync');

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
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run']);
	await promiseB1;
	await promiseA2;
	await promiseA3;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done']);
	await promiseA4;
	assert.equal(results, ['a1_run', 'b1_run', 'a1_done', 'a4_run', 'b1_done', 'a4_done']);
});

test__throttleAsync.run();
/* test__throttleAsync */
