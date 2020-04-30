# task

> task runner for
> [Gro](https://github.com/feltcoop/gro)

A Gro task is just a function with some metadata.
Gro prefers conventions and code over configuration,
and its task runner leverages the filesystem as the API
and defers composition to the user.

- automatically discovers all `*.task.ts` files in your source directory
- task definitions are just async functions in TypeScript modules,
  so chaining and composition are explicit in your code
- it's easy to hook into or override any of Gro's builtin tasks,
  like [`test`](../oki) and [`gen`](../gen)
- it's fast because it imports only the modules that your chosen tasks need

The task runner's purpose is to provide an ergonomic interface
between the CLI, build tools, and app code.
It tries to dissolve walls that typically separate these domains
while deferring to your code and facilitating buildtime development processes.

## usage

Show all available tasks:

```bash
# This looks through `src/` in both the current working directory
# and Gro's source for all files matching `*.task.ts` and prints them out.
$ gro
```

Run a task:

```bash
# This runs `src/some/thing.task.ts`, or if it doesn't exist,
# `gro/src/some/thing.task.ts`.
# If neither exists, it will display an error.
$ gro some/thing arg1 arg2 --arg3 example
```

Define a task:

```ts
// src/some/thing.task.ts
import {Task} from '@feltcoop/gro/task/task.js';

export const task: Task = {
	run: async ({log, args}) => {
		log.info('CLI args', args); // => {_: ['arg1', 'arg2'], arg3: 'example'}
		await whatever();
	},
};
```

Hook into one of Gro's builtin tasks:

```bash
# This normally loads Gro's version of the test task at `gro/src/test.task.ts`,
# but projects can define `src/test.task.ts` to extend or replace it.
$ gro test
```

```ts
// src/test.task.ts
import {Task} from '@feltcoop/gro/task/task.js';
import {task as testTask} from '@feltcoop/gro/test.task.js';

export const task: Task = {
	run: async ({log, args}) => {
		await doSomethingFirst();
		// This wraps Gro's `test` task, but it doesn't have to!
		await testTask.run({log, args: {...args, modifyTheArgs: true}});
		await andAfterIfYouWant();
	},
};
```

Note that when hooking into Gro's builtin tasks,
like `test.task.ts` above, you don't have to call its version.
This lets projects fully customize Gro's builtin tasks.

## future improvements

- [ ] watch mode
- [ ] consider a pattern for declaring and validating CLI args
