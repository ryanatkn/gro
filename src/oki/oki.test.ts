import {test} from './index';
import {wait} from '../utils/asyncUtils';

test('test', t => {
	test('equal', () => {
		t.equal(2, 2);
	});

	test('equal2', () => {
		t.equal(2, 2);
	});

	test('nested1', () => {
		test('nested2', () => {
			test('nested3a', () => {
				test('nested4a', () => {
					t.equal(4, 4);
				});
				test('nested4b', () => {
					t.equal(4, 4);
				});
			});
			test('nested3b', () => {});
		});
	});

	test('sync1', () => {
		t.equal(8, 8);
		test('sync2a', () => {
			t.equal(8, 8);
			test('sync3a', () => {
				t.equal(8, 8);
				test('sync4a', () => {
					t.equal(8, 8);
				});
				t.equal(8, 8);
				test('sync4b', () => {
					t.equal(8, 8);
				});
				t.equal(8, 8);
			});
			t.equal(8, 8);
			test('sync3b', () => {
				t.equal(8, 8);
			});
			t.equal(8, 8);
		});
		test('sync2b', () => {
			t.equal(8, 8);
		});
		test('sync2c', () => {
			t.equal(8, 8);
			test('sync3a', () => {
				t.equal(8, 8);
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
			t.equal(waitValue1, 2);
		});
		test('nested async test runs after parent completes', async () => {
			t.equal(waitValue1, 2);
		});
		test('nested async test with delay runs after parent completes', async () => {
			await wait();
			t.equal(waitValue1, 2);
		});
		await test('awaited nested async test with delay runs after parent completes', async () => {
			await wait();
			t.equal(waitValue1, 2);
			waitValue2 = 2;
		});
		t.equal(waitValue1, 1);
		waitValue1 = 2;
	});
	test('runs after async', () => {
		t.equal(waitValue1, 2);
		t.equal(waitValue2, 2);
	});
});
