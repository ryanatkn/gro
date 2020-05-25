# oki

> testing library for
> [Gro](https://github.com/feltcoop/gro)

## motivation

`oki` is a testing library that's a foundational part of the larger set of
[Gro](https://github.com/feltcoop/gro) tools.
The plan is to deeply integrate it with build tooling.
We don't encourage anyone to use it but you're welcome to try!

The `oki` modules are used by the task [`gro test`](../test.task.ts).
By convention, `gro test` looks for all files named `*.test.ts`
and executes them inside an `oki` context.

## usage

```bash
# test all `*.test.ts` files in `src/`
gro test

# test all `*.test.ts` files in a directory
gro test some/dir

# test a specific file
gro test some/file # looks for `src/some/file.test.ts`
gro test some/file.test.ts # or specify the full file name

# test multiple files and directories
gro test some/file1 file2 some/dir1 dir2
```

```ts
// file.test.ts
import {test, t} from '@feltcoop/gro';
test('something', () => {
	t.ok('basic assertion');
	t.is(NaN, NaN);
	t.equal({deep: ['equality']}, {deep: ['equality']});
	// for more, see the assertions api docs below

	test('execution order', () => {
		test('1', () => {
			test('2', () => {});
			test('3', () => {
				test('4', () => {});
			});
		});
		test('5', () => {});
		test('6', () => {});
	});

	test('can return a promise', async () => {
		await promise;
	});

	let nested_tests_run_after_parent_scope;
	test('nested', () => {
		t.ok(nested_tests_run_after_parent_scope);
	});
	nested_tests_run_after_parent_scope = true;
});
```

## api

```ts
import {test, t} from '@feltcoop/gro';
test('assertions api', ({
	log, // `Logger` instance: {trace, info, warn, error, plain}
}) => {
	t.ok('oki :)');
	t.is(true, true);
	t.equal({a: 1}, {a: 1});
	t.throws(() => {
		throw Error('we good');
	});
});
typeof t; // => `Assertions`
interface Assertions {
	ok(value: any); // truthy
	is(actual: any, expected: any); // `Object.is`
	isNot(actual: any, expected: any); // `!Object.is`
	equal(actual: any, expected: any); // deeply equal
	notEqual(actual: any, expected: any); // !deeply equal
	throws(
		// expects `cb` to throw an error that matches optional `matcher`
		cb: () => void,
		matcher?: ErrorClass | RegExp | string,
	);
	rejects(
		// expects `cbOrPromise` to throw an error that matches optional `matcher`
		cbOrPromise: Promise<any> | (() => Promise<void>),
		matcher?: ErrorClass | RegExp | string,
	);
	fail(message: string); // throws a `TestAssertionError` (t.Error)
	Error(message: string); // the `TestAssertionError` class for deliberate fails
}
```

## todo

- [x] basics
- [ ] watch mode
- [ ] better reporting (like diffing)
- [ ] caching
- [ ] run in browser
