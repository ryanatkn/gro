# oki

> testing library for
> [Gro](https://github.com/feltcoop/gro)

## motivation

`oki` is a testing library that's a foundational part of the larger set of
[Gro](https://github.com/feltcoop/gro) tools.
The plan is to deeply integrate it with build tooling.
We don't encourage anyone to use it but you're welcome to try!

The `oki` modules are used by the command `gro test`.
By convention, `gro test` looks for all files named `*.test.ts`
and executes them inside an `oki` context.

## todo

- [x] basics
- [ ] watch mode
- [ ] better reporting (like diffing)
- [ ] caching
- [ ] better docs
- [ ] run in browser

## usage

```bash
# test all *.test.ts files
gro test

# test a specific file
gro test path/to/file.test.ts # looks for src/path/to/file.test.ts

# test multiple files
gro test file1.test.ts file2.test.ts
```

```ts
// file.test.ts
import {test, t} from '@feltcoop/gro/oki.js';
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
	// TODO do we want to change this behavior? what are all of the tradeoffs?
});
```

## api

```ts
import {test, t} from '@feltcoop/gro/oki.js';
test('assertions api', ({
  log: {trace; info; warn; error; plain}; // Logger instance
}) => {
  t.ok('oki :)');
  t.is(true, true);
  t.equal({a: 1}, {a: 1});
});
typeof t; // => Assertions
interface Assertions {
  ok(value: any); // truthy
  is(actual: any, expected: any); // Object.is
  isNot(actual: any, expected: any); // !Object.is
  equal(actual: any, expected: any); // deeply equal
  notEqual(actual: any, expected: any); // !deeply equal
  // expects `cb` to throw an error that matches optional `matcher`
  throws(cb: () => void, matcher?: ErrorClass | RegExp | string);
  fail(message: string); // throws a TestAssertionError (t.Error)
  Error(message: string); // the TestAssertionError class for intentional fails
}
```
