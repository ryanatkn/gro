# test

Gro uses [`uvu`](https://github.com/lukeed/uvu) for tests --
when you run `gro test [...args]`, you're running `uvu [...args]` inside
Gro's normal [task context](/src/lib/docs/task.md).
Internally, Gro has its own build system for your `src/` files,
and it points `uvu` at Gro's compiled JS outputs.

A typical workflow includes running `gro dev` in one terminal
and `gro test` in another when you want to check things.

> TODO add support for automatic test re-running

```bash
gro test # run all tests
gro test Filer.test # run tests matching an uvu pattern: https://github.com/lukeed/uvu
```

The builtin [`gro test`](/src/test.task.ts)
[task](/src/lib/docs/task.md) runs all `*.test.*` files in your project by default.
(excluding [`*.gen.*` files](/src/lib/docs/gen.md))
So to make new tests, make a new file:

```ts
// src/lib/importedThing.test.ts <-- make this file to test this one --> src/lib/importedThing.ts
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {importedThing} from '$lib/importedThing.js';

/* test__importedThing */
const test__importedThing = suite('importedThing');

test__importedThing('basic behavior', async () => {
	assert.equal(importedThing, {expected: true});
});

test__importedThing.run();
/* test__importedThing */
```

There are some conventions here that we're following
in the hopes they'll aid readability, help avoid mistakes,
and possibly pay off in more ways down the line:

- double underscore `test__` prefix
- opening and closing tags `/* test__importedThing */` around each suite
- name each suite according to what it's testing, as much as makes sense

We recommend copy/pasting test files to avoid tedium.

# 🐌