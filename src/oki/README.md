# oki

> testing library for
> [`gro`](https://github.com/ryanatkn/gro)

## motivation

`oki` is a testing library that's a foundational part of the larger set of
[`gro`](https://github.com/ryanatkn/gro) tools.
The plan is to deeply integrate it with build tooling.
I don't encourage anyone to use it but you're welcome to try!

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
# run all *.test.ts files
gro test

# run specific files
gro test path/to/file.test.ts file2.test.ts
```

```ts
// file.test.ts
import {test} from 'oki';
test('something', t => {
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
import {test} from 'oki';
test('assertions api', (t: {
	ok(value: any); // truthy
	notOk(value: any); // falsy
	is(actual: any, expected: any); // Object.is
	isNot(actual: any, expected: any); // !Object.is
	equal(actual: any, expected: any); // deeply equal
	notEqual(actual: any, expected: any); // !deeply equal
	fail(message: string); // throws an error
	// expects `cb` to throw an error that matches optional `matcher`
	throws(cb: () => void, matcher?: ErrorClass | RegExp | string);
	log: {trace; info; warn; error; plain}; // Logger instance
}) => {
	t.ok('oki :)');
});
```
