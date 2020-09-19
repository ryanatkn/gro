import {test, t} from '../oki/oki.js';
import {AssertionError} from './assertions.js';

test('assertions', () => {
	test('fail()', () => {
		const message = 'not oki';
		try {
			t.fail(message);
		} catch (err) {
			if (err instanceof AssertionError) {
				if (err.assertion.operator !== 'fail') {
					throw Error(`Expected error operator to be "${'fail'}"`);
				}
				return;
			} else {
				throw Error('Expected error to be a AssertionError');
			}
		}
	});

	const failToThrow = (cb: () => void): AssertionError => {
		try {
			cb();
		} catch (err) {
			if (err instanceof AssertionError) {
				if (err.assertion.operator !== 'throws') {
					t.fail(`Expected error operator to be "${'throws'}"`);
				}
				return err; // success
			} else {
				t.fail('Expected error to be a AssertionError');
			}
		}
		t.fail(`Expected an error`);
	};
	test('throws() ✓', async () => {
		t.throws(() => {
			throw Error();
		});
	});
	test('throws() 🞩', () => {
		failToThrow(() => {
			t.throws(() => {});
		});
	});
	test('throws() with a string matcher ✓', async () => {
		const thrownError = new Error('~~~match this error message~~~');
		t.throws(() => {
			throw thrownError;
		}, 'match this error message');
	});
	test('throws() with a string matcher 🞩', () => {
		failToThrow(() => {
			t.throws(() => {
				throw Error('foo');
			}, 'food');
		});
	});
	test('throws() with a RegExp matcher ✓', async () => {
		const thrownError = new Error('match me with a regexp');
		t.throws(() => {
			throw thrownError;
		}, /witH.+ReGeX/i);
	});
	test('throws() with a RegExp matcher 🞩', () => {
		failToThrow(() => {
			t.throws(() => {
				throw Error('foo');
			}, /food/);
		});
	});
	test('throws() with an ErrorClass matcher ✓', async () => {
		class SomeError extends Error {}
		const thrownError = new SomeError();
		t.throws(() => {
			throw thrownError;
		}, SomeError);
	});
	test('throws() with an ErrorClass matcher 🞩', () => {
		class SomeError extends Error {}
		failToThrow(() => {
			t.throws(() => {
				throw Error();
			}, SomeError);
		});
	});

	const failToReject = async (cb: () => Promise<void>): Promise<AssertionError> => {
		try {
			await cb();
		} catch (err) {
			if (err instanceof AssertionError) {
				if (err.assertion.operator !== 'rejects') {
					t.fail(`Expected error operator to be "${'rejects'}"`);
				}
				return err; // success
			} else {
				t.fail('Expected error to be a AssertionError');
			}
		}
		t.fail(`Expected an error`);
	};
	test('rejects() ✓', async () => {
		await t.rejects(async () => {
			throw Error();
		});
	});
	test('rejects() 🞩', async () => {
		await failToReject(async () => {
			await t.rejects(async () => {});
		});
	});
	test('rejects() a promise ✓', async () => {
		await t.rejects(new Promise((_, reject) => reject()));
	});
	test('rejects() a promise 🞩', async () => {
		await failToReject(async () => {
			await t.rejects(new Promise((resolve) => resolve()));
		});
	});
	test('rejects() with a string matcher ✓', async () => {
		const thrownError = new Error('~~~match this error message~~~');
		await t.rejects(async () => {
			throw thrownError;
		}, 'match this error message');
	});
	test('rejects() with a string matcher 🞩', async () => {
		await failToReject(async () => {
			await t.rejects(async () => {
				throw Error('foo');
			}, 'food');
		});
	});
	test('rejects() with a RegExp matcher ✓', async () => {
		const thrownError = new Error('match me with a regexp');
		await t.rejects(async () => {
			throw thrownError;
		}, /witH.+ReGeX/i);
	});
	test('rejects() with a RegExp matcher 🞩', async () => {
		await failToReject(async () => {
			await t.rejects(async () => {
				throw Error('foo');
			}, /food/);
		});
	});
	test('rejects() with an ErrorClass matcher ✓', async () => {
		class SomeError extends Error {}
		const thrownError = new SomeError();
		await t.rejects(async () => {
			throw thrownError;
		}, SomeError);
	});
	test('rejects() with an ErrorClass matcher 🞩', async () => {
		class SomeError extends Error {}
		await failToReject(async () => {
			await t.rejects(async () => {
				throw Error();
			}, SomeError);
		});
	});

	test('ok() ✓', () => {
		t.ok(true);
		t.ok(1);
		t.ok(' ');
		t.ok({});
	});
	test('ok() 🞩', () => {
		t.throws(() => t.ok(false));
		t.throws(() => t.ok(0));
		t.throws(() => t.ok(''));
		t.throws(() => t.ok(null));
	});

	test('is() ✓', () => {
		t.is(0, 0);
		t.is('hi', 'hi');
		const obj = {a: 1};
		t.is(obj, obj);
		const arr = [1, 'a'];
		t.is(arr, arr);
		t.is(NaN, NaN);
		t.is(-Infinity, -Infinity);
	});
	test('is() 🞩', () => {
		t.throws(() => t.is(0, -1));
		t.throws(() => t.is('hi', 'h'));
		t.throws(() => t.is({a: 1}, {a: 1}));
		t.throws(() => t.is([1, 'a'], [1, 'a']));
		t.throws(() => t.is(NaN, 1));
		t.throws(() => t.is(-Infinity, Infinity));
	});

	test('isNot() ✓', () => {
		t.isNot(0, -1);
		t.isNot('hi', 'h');
		t.isNot({a: 1}, {a: 1});
		t.isNot([1, 'a'], [1, 'a']);
		t.isNot(NaN, 1);
		t.isNot(-Infinity, Infinity);
	});
	test('isNot() 🞩', () => {
		t.throws(() => t.isNot('hi', 'hi'));
		t.throws(() => {
			const obj = {a: 1};
			t.isNot(obj, obj);
		});
		t.throws(() => {
			const arr = [1, 'a'];
			t.isNot(arr, arr);
		});
		t.throws(() => t.isNot(NaN, NaN));
		t.throws(() => t.isNot(-Infinity, -Infinity));
	});

	test('equal() ✓', () => {
		t.equal(0, 0);
		t.equal('hi', 'hi');
		t.equal({a: 1}, {a: 1});
		t.equal({a: 1, b: 2}, {a: 1, b: 2});
		t.equal([1, 'a'], [1, 'a']);
		t.equal([1, 'a', [1, 'a']], [1, 'a', [1, 'a']]);
		t.equal(NaN, NaN);
		t.equal(-Infinity, -Infinity);
	});
	test('equal() 🞩', () => {
		t.throws(() => t.equal(0, -1));
		t.throws(() => t.equal('hi', 'h'));
		t.throws(() => t.equal({a: 1}, {a: 1, b: 2}));
		t.throws(() => t.equal({a: 1, b: 2}, {a: 1}));
		t.throws(() => t.equal([1, 'a'], [1]));
		t.throws(() => t.equal([1, 'a'], ['a']));
		t.throws(() => t.equal([1, 'a'], ['a', 1]));
		t.throws(() => t.equal([1, 'a'], ['1', 'a']));
		t.throws(() => t.equal([1, 'a', [1, 'a']], [1, 'a', ['a']]));
		t.throws(() => t.equal(NaN, 1));
		t.throws(() => t.equal(-Infinity, Infinity));
	});

	test('notEqual() ✓', () => {
		t.notEqual(0, -1);
		t.notEqual('hi', 'h');
		t.notEqual({a: 1}, {a: 1, b: 2});
		t.notEqual({a: 1, b: 2}, {a: 1});
		t.notEqual([1, 'a'], [1]);
		t.notEqual([1, 'a'], ['a']);
		t.notEqual([1, 'a'], ['a', 1]);
		t.notEqual([1, 'a'], ['1', 'a']);
		t.notEqual([1, 'a', [1, 'a']], [1, 'a', ['a']]);
		t.notEqual(NaN, 1);
		t.notEqual(-Infinity, Infinity);
	});
	test('notEqual() 🞩', () => {
		t.throws(() => t.notEqual(0, 0));
		t.throws(() => t.notEqual('hi', 'hi'));
		t.throws(() => t.notEqual({a: 1}, {a: 1}));
		t.throws(() => t.notEqual({a: 1, b: 2}, {a: 1, b: 2}));
		t.throws(() => t.notEqual([1, 'a'], [1, 'a']));
		t.throws(() => t.notEqual([1, 'a', [1, 'a']], [1, 'a', [1, 'a']]));
		t.throws(() => t.notEqual(NaN, NaN));
		t.throws(() => t.notEqual(-Infinity, -Infinity));
	});
});
