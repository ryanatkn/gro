# test

Gro uses [`uvu`](https://github.com/lukeed/uvu) for tests.
Internally, Gro has its own build system for your `src/` files,
and it points `uvu` at Gro's compiled JS outputs.

A typical workflow includes running `gro dev` in one terminal
and `gro test` in another when you want to check things.
There is currently no watcher and automatic re-running. (TODO)

```bash
gro test # run all tests
gro test build/Filer.test.js\$ # run tests matching an uvu pattern: https://github.com/lukeed/uvu
```

The builtin [`gro test`](/src/test.task.ts)
[task](/src/task/README.md) runs all `*.test.*` files in your project by default.
(excluding [`*.gen.*` files](/src/gen/README.md))
So to make new tests, make a new file:

```ts
// src/lib/imported_thing.test.ts testing src/lib/imported_thing.ts
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {inputed_thing} from '$lib/imported_thing.js';

/* test__imported_thing */
const test__imported_thing = suite('imported_thing');

test__imported_thing('basic behavior', async () => {
	t.equal(imported_thing, {expected: true});
});

test__imported_thing.run();
/* test__imported_thing */
```

There are some conventions here that we're following
in the hopes it will pay off down the line:

- double underscore `test__` prefix
- opening and closing tags `/* test__imported_thing */`

The motivation behind these choices include readability and uniformity to avoid mistakes.

We recommend copy/pasting test files to avoid tedium.

# 🐌
