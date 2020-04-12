import {test, t} from '../oki/oki.js';
import {AssertionError, AssertionOperator} from './assertions.js';

test('assertions', () => {
	test('fail()', () => {
		const message = 'not oki';
		try {
			throw new t.Error(message);
		} catch (err) {
			// can't use `instanceof` right now because gro is self-testing, has two copies of modules for runner/tests
			if (err.constructor.name === t.Error.name) {
				if (err.assertion.operator !== AssertionOperator.fail) {
					throw Error(
						`Expected error operator to be "${AssertionOperator.fail}"`,
					);
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
			// can't use `instanceof` right now because gro is self-testing, has two copies of modules for runner/tests
			if (err.constructor.name === AssertionError.name) {
				if (err.assertion.operator !== AssertionOperator.throws) {
					throw new t.Error(
						`Expected error operator to be "${AssertionOperator.throws}"`,
					);
				}
				return err; // success
			} else {
				throw new t.Error('Expected error to be a AssertionError');
			}
		}
		throw new t.Error(`Expected an error`);
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

	test('notOk() ✓', () => {
		t.notOk(false);
		t.notOk(0);
		t.notOk('');
		t.notOk(null);
	});
	test('notOk() 🞩', () => {
		t.throws(() => t.notOk(true));
		t.throws(() => t.notOk(1));
		t.throws(() => t.notOk(' '));
		t.throws(() => t.notOk({}));
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

const skip: typeof test = Function.prototype as any;

skip('failed assertions', () => {
	test('fail()', () => {
		throw new t.Error('this test failed because errror');
	});

	const failToThrow = (cb: () => void): AssertionError => {
		try {
			cb();
		} catch (err) {
			if (err instanceof AssertionError) {
				if (err.assertion.operator !== AssertionOperator.throws) {
					throw new t.Error(
						`Expected error operator to be "${AssertionOperator.throws}"`,
					);
				}
				return err; // success
			} else {
				throw new t.Error('Expected error to be a AssertionError');
			}
		}
		throw new t.Error(`Expected an error`);
	};
	test('throws() ✓', async () => {
		failToThrow(() => {
			t.throws(() => {
				throw Error();
			});
		});
	});
	test('throws() 🞩', () => {
		t.throws(() => {});
	});
	test('throws() an error unmatched by Error class', () => {
		class SomeError extends Error {}
		t.throws(() => {
			throw Error();
		}, SomeError);
	});
	test('throws() an error unmatched by regexp', () => {
		t.throws(() => {
			throw Error('foo');
		}, /food/);
	});
	test('throws() an error unmatched by message substring', () => {
		t.throws(() => {
			throw Error('foo');
		}, 'food');
	});

	test('ok()', () => {
		t.ok(0);
	});

	test('notOk()', () => {
		t.notOk(true);
	});

	test('is()', () => {
		t.is(0, 1);
	});

	test('isNot()', () => {
		t.isNot(0, 0);
	});

	test('equal() with numbers', () => {
		t.equal(0, 1);
	});
	test('equal() with bigints', () => {
		t.equal(BigInt(40000000000), BigInt(40000000001));
	});
	test('equal() with strings', () => {
		t.equal('hello', 'hell');
	});
	test('equal() with booleans', () => {
		t.equal(true, false);
	});
	test('equal() with null and undefined', () => {
		t.equal(null, undefined);
	});
	test('equal() with symbols', () => {
		t.equal(Symbol(), Symbol());
	});
	test('equal() with objects', () => {
		t.equal({a: 1, b: {c: {d: 2}}}, {a: 1, b: {c: {d: 3}}});
	});
	test('equal() with functions', () => {
		function fn() {
			return 'hello world';
		}
		t.equal(fn, () => 'hello world');
	});

	test('notEqual() with numbers', () => {
		t.notEqual(0, 0);
	});
	test('notEqual() with objects', () => {
		t.notEqual({a: 1, b: {c: {d: 3}}}, {a: 1, b: {c: {d: 3}}});
	});
});
