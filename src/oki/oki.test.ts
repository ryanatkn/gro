import {test} from './oki.js';
import {wait} from '../utils/async.js';

test('test()', t => {
	test('is', () => {
		t.is(2 + 2, 4);
	});

	test('equal', () => {
		t.equal({math: 2 + 2}, {math: 4});
	});

	// see ./assertions.test.ts for more

	test('nested1', () => {
		test('nested2', () => {
			t.is('nested', 'nested');
		});
	});

	test('sync execution order', () => {
		let syncCount = 0;
		test('sync execution order2a', () => {
			t.is(syncCount++, 1);
			test('sync execution order3a', () => {
				t.is(syncCount++, 3);
			});
			test('sync execution order3b', () => {
				t.is(syncCount++, 4);
				test('sync execution order4', () => {
					t.is(syncCount++, 6);
				});
				t.is(syncCount++, 5);
			});
			t.is(syncCount++, 2);
		});
		test('sync execution order2b', () => {
			t.is(syncCount++, 7);
		});
		test('sync execution order2c', () => {
			t.is(syncCount++, 8);
		});
		t.is(syncCount++, 0);
	});

	test('async execution order', async () => {
		let asyncCount = 0;
		test('async execution order2a', async () => {
			await wait();
			t.is(asyncCount++, 1);
			test('async execution order3a', async () => {
				await wait();
				t.is(asyncCount++, 3);
			});
			test('async execution order3b', async () => {
				await wait();
				t.is(asyncCount++, 4);
				test('async execution order4', async () => {
					await wait();
					t.is(asyncCount++, 6);
				});
				await wait();
				t.is(asyncCount++, 5);
			});
			await wait();
			t.is(asyncCount++, 2);
		});
		test('async execution order2b', async () => {
			await wait();
			t.is(asyncCount++, 7);
		});
		test('async execution order2c', async () => {
			await wait();
			t.is(asyncCount++, 8);
		});
		await wait();
		t.is(asyncCount++, 0);
	});
});
