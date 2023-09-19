# test

Gro integrates [`uvu`](https://github.com/lukeed/uvu) for tests:

```bash
gro test # run all tests with Gro's default `*.test.ts` pattern
gro test thing.test somedir test/a.+b # run tests matching regexp patterns
```

> Running `gro test [...args]` calls `uvu`'s `parse` and `run` helpers
> inside Gro's normal [task context](/src/lib/docs/task.md) instead of using the `uvu` CLI.
> Gro typically defers to a tool's CLI, so it can transparently forward args without wrapping,
> but in this case `uvu` doesn't support [loaders](https://nodejs.org/api/esm.html#loaders)
> for running TypeScript files directly.
> `uvu` does support require hooks, but Gro prefers the loader API.

Like other tasks, use `--help` to see the args info:

```bash
gro test --help
```

outputs:

```
gro test: run tests
[...args]  string[]           ["\\.test\\.ts$"]  file patterns to test
bail       boolean            false              the bail option to uvu run, exit immediately on failure
cwd        string             undefined          the cwd option to uvu parse
ignore     string | string[]  undefined          the ignore option to uvu parse
```

[`gro test`](/src/test.task.ts) runs all `*.test.ts`
files in your project by default using the regexp `"\\.test\\.ts$"`.
So to add a new test, create a new file:

```ts
// by convention, create `src/lib/thing.ts`
// to test `src/lib/thing.test.ts`
import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {thing} from '$lib/thing.js';

test('the thing', async () => {
	assert.equal(thing, {expected: true});
});

test.run();
```

See [the `uvu` docs](https://github.com/lukeed/uvu) for more.
