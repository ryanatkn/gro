# test

Gro uses [`uvu`](https://github.com/lukeed/uvu) for tests --
when you run `gro test [...args]`, you're running `uvu [...args]` inside
Gro's normal [task context](/src/docs/task.md).
Internally, Gro has its own build system for your `src/` files,
and it points `uvu` at Gro's compiled JS outputs.

A typical workflow includes running `gro dev` in one terminal
and `gro test` in another when you want to check things.

> TODO add support for automatic test re-running

```bash
gro test # run all tests
gro test build/Filer.test.js\$ # run tests matching an uvu pattern: https://github.com/lukeed/uvu
```

> TODO exclude `.map` files by default, making the `\$` above unnecessary

The builtin [`gro test`](/src/test.task.ts)
[task](/src/docs/task.md) runs all `*.test.*` files in your project by default.
(excluding [`*.gen.*` files](/src/docs/gen.md))
So to make new tests, make a new file:

```ts
// src/lib/importedThing.test.ts <-- make this file to test this one --> src/lib/importedThing.ts
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {importedThing} from '$lib/importedThing.js';

/* test___importedThing */
const test___importedThing = suite('importedThing');

test___importedThing('basic behavior', async () => {
	t.equal(importedThing, {expected: true});
});

test___importedThing.run();
/* test___importedThing */
```

There are some conventions here that we're following
in the hopes they'll aid readability, help avoid mistakes,
and possibly pay off in more ways down the line:

- double underscore `test___` prefix
- opening and closing tags `/* test___importedThing */` around each suite
- name each suite according to what it's testing, as much as makes sense

We recommend copy/pasting test files to avoid tedium.

# 🐌
