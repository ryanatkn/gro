# task

> task runner for
> [Gro](https://github.com/feltcoop/gro)

A Gro task is just a function with some metadata.
Gro prefers conventions and code over configuration,
and its task runner leverages the filesystem as the API
and defers composition to the user in regular TypeScript modules.

- Gro automatically discovers all `*.task.ts` files in your source directory,
  so creating a new task is as simple as creating a new file -
  no configuration or scaffolding commands needed!
- task definitions are just objects with an async `run` function and some metadata,
  so composing tasks is explicit in your code, just like any other module
- on the command line, tasks replace the concept of commands,
  so running them is as simple as `gro <task>`,
  and in code the task object's `run` function has access to CLI args
- it's easy to hook into or override any of Gro's builtin tasks,
  like [`gro test`](../oki) and [`gro gen`](../gen)
- it's fast because it imports only the modules that your chosen tasks need

The task runner's purpose is to provide an ergonomic interface
between the CLI, build tools, and app code.
It tries to dissolve walls that typically separate these domains
while deferring to your code and facilitating buildtime development processes.

## usage

### show all available tasks

```bash
# This looks through `src/` in both the current working directory
# and Gro's source for all files matching `*.task.ts` and prints them out.
$ gro
```

### show tasks in a directory

```bash
# Prints all `*.task.ts` files in `src/some/dir`.
$ gro some/dir
```

### run a task

```bash
# This runs `src/some/thing.task.ts`,
# or if it doesn't exist, `gro/src/some/thing.task.ts`.
# If neither exists, it will display an error.
$ gro some/thing arg1 arg2 --arg3 example
```

### define a task

```ts
// src/some/thing.task.ts
import {Task} from '@feltcoop/gro/dist/task/task.js';

export const task: Task = {
	run: async ({log, args}) => {
		log.info('CLI args', args); // => {_: ['arg1', 'arg2'], arg3: 'example'}
		await whatever();
	},
};
```

> To learn more about the Gro CLI path conventions,
> see [the `inputPaths` comments](../files/inputPaths.ts)

### hook into one of [Gro's builtin tasks](../docs/tasks.md)

```bash
# This normally loads Gro's version of the test task at `gro/src/test.task.ts`,
# but projects can define `src/test.task.ts` to extend or replace it.
$ gro test
```

```ts
// src/test.task.ts
import {Task} from '@feltcoop/gro/dist/task/task.js';
import {task as testTask} from '@feltcoop/gro/dist/test.task.js';

export const task: Task = {
	run: async ({log, args}) => {
		await doSomethingFirst();
		// This wraps Gro's `test` task, but it doesn't have to!
		await testTask.run({log, args: {...args, modifyTheArgs: true}});
		await andAfterIfYouWant();
	},
};
```

Note that when hooking into [Gro's builtin tasks](../docs/tasks.md),
like `test.task.ts` above, you don't have to call its version.
This lets projects fully customize every task.

## future improvements

- [ ] watch mode
- [ ] consider a pattern for declaring and validating CLI args
