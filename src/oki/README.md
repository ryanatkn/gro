# oki

> testing library

## motivation

`oki` is a foundational part of the larger set of `gro` tools.
I plan to deeply integrate it with build tooling
and experiment with stuff like code generation.
I don't encourage anyone to use it but you're welcome to try!

## todo

- [x] basics
- [ ] watch mode
- [ ] better reporting (like diffing)
- [ ] caching
- [ ] better docs
- [ ] run in browser

## usage

```bash
gro test # run all *.test.ts files
gro test path/to/file.test.ts file2.test.ts
```

```ts
// file.test.ts
import {test} from 'oki';
test('something', t => {
	t.ok('basic assertion');
	t.is(NaN, NaN);
	t.equal({deep: ['equality']}, {deep: ['equality']});

	let nested_tests_run_after_parent_scope;
	test('nested', () => {
		t.ok(nested_tests_run_after_parent_scope);
	});
	nested_tests_run_after_parent_scope = true;

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
});
```

## api

```ts
import {test} from 'oki';
test('api', (t: {
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
