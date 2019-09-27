import {test} from './index.js';
import {wait} from '../utils/async.js';

test('test()', t => {
	test('is', () => {
		t.is(2 + 2, 4);
	});

	test('equal', () => {
		t.equal({math: 2 + 2}, {math: 4});
	});

	test('nested1', () => {
		test('nested2', () => {
			test('nested3a', () => {
				test('nested4a', () => {
					t.is(4, 4);
				});
				test('nested4b', () => {
					t.is(4, 4);
				});
			});
			test('nested3b', () => {});
		});
	});

	test('sync1', () => {
		t.is(8, 8);
		test('sync2a', () => {
			t.is(8, 8);
			test('sync3a', () => {
				t.is(8, 8);
				test('sync4a', () => {
					t.is(8, 8);
				});
				t.is(8, 8);
				test('sync4b', () => {
					t.is(8, 8);
				});
				t.is(8, 8);
			});
			t.is(8, 8);
			test('sync3b', () => {
				t.is(8, 8);
			});
			t.is(8, 8);
		});
		test('sync2b', () => {
			t.is(8, 8);
		});
		test('sync2c', () => {
			t.is(8, 8);
			test('sync3a', () => {
				t.is(8, 8);
			});
		});
	});

	let count = 0;
	test('sync execution order1', () => {
		t.is(count, 0);
		count++;
		test('sync execution order2a', () => {
			t.is(count, 1);
			count++;
			test('sync execution order3a', () => {
				t.is(count, 2);
				count++;
			});
			test('sync execution order3b', () => {
				t.is(count, 3);
				count++;
				test('sync execution order4', () => {
					t.is(count, 4);
					count++;
				});
				t.is(count, 4);
			});
			t.is(count, 2);
		});
		test('sync execution order2b', () => {
			t.is(count, 5);
			count++;
		});
		test('sync execution order2c', () => {
			t.is(count, 6);
		});
		t.is(count, 1);
	});
	t.is(count, 0);

	let waitValue1 = 1;
	let waitValue2 = 1;
	test('async', async () => {
		await wait();
		test('nested sync test runs after parent completes', () => {
			t.is(waitValue1, 2);
		});
		test('nested async test runs after parent completes', async () => {
			t.is(waitValue1, 2);
		});
		test('nested async test with delay runs after parent completes', async () => {
			await wait();
			t.is(waitValue1, 2);
		});
		await test('awaited nested async test with delay runs after parent completes', async () => {
			await wait();
			t.is(waitValue1, 2);
			waitValue2 = 2;
		});
		t.is(waitValue1, 1);
		waitValue1 = 2;
	});
	test('runs after async', () => {
		t.is(waitValue1, 2);
		t.is(waitValue2, 2);
	});
});
