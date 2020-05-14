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
# and Gro's source for all files matching `*.task.ts` and logs them out.
$ gro
```

### show tasks in a directory

```bash
# Logs all `*.task.ts` files in `src/some/dir` and `gro/src/some/dir`.
# If neither exists, it displays an error.
$ gro some/dir
```

> To learn more about the Gro CLI path conventions,
> see [the `inputPaths` comments](../fs/inputPath.ts)

### run a task

```bash
# This runs `src/some/file.task.ts`,
# or if it doesn't exist, `gro/src/some/file.task.ts`.
# If neither exists, it displays an error.
$ gro some/file arg1 arg2 --arg3 example
```

### define a task

```ts
// src/some/file.task.ts
import {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({log, args}) => {
		log.info('CLI args', args); // => {_: ['arg1', 'arg2'], arg3: 'example'}
		await whatever();
	},
};
```

### hook into one of [Gro's builtin tasks](../docs/tasks.md)

```bash
# This normally loads Gro's version of the test task at `gro/src/test.task.ts`,
# but projects can define `src/test.task.ts` to extend or replace it.
$ gro test
```

```ts
// src/test.task.ts
import {Task} from '@feltcoop/gro';
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

### throwing errors

If a task encounters an error, it should throw rather than exiting the process.
This defers control to the caller, like your own parent tasks.
Often, errors that tasks encounter do not need a stack trace,
and we don't want the added noise to be logged.
To suppress logging the stack trace for an error,
throw a `TaskError`.

```ts
import {Task, TaskError} from '@feltcoop/gro';

export const task: Task = {
	run: async () => {
		if (someErrorCondition) {
			throw new TaskError('We hit a known error - ignore the stack trace!');
		}
	},
};
```

## future improvements

- [ ] watch mode
- [ ] consider a pattern for declaring and validating CLI args

## why?

Gro usage on the command line (`gro <task_or_directory> [...flags]`)
looks a lot like using `node`.
What makes Gro different?

- The `*.task.ts` file name convention signals to Gro that your application
  contains task modules that conform to some interface.
  This allows them to be discoverable and puts generic handles on them,
  enabling various verbs (e.g. "run") and
  structured metadata (e.g. "description").
- Tasks can be imported, inspected, combined, and manipulated in code.
  Task modules do not have any side effects when imported,
  while Node scripts just execute when imported -
  their primary purpose is to cause side effects.
- Module resolution is different,
  and not just by making `.task.ts` optional.
  - When a task name is given to Gro,
    it first searches the current working directory and
    falls back to searching the Gro directory.
    This allows your code to use Gro's builtin tasks or override them,
    and you can make your own tasks using the same conventions that Gro uses.
    Gro reserves no special behavior for its own commands -
    `gro test` and all the rest are just tasks that all follow the same rules.
    (see its task at [`src/test.task.ts`](../test.task.ts))
  - When a directory is given to Gro,
    it prints all of the tasks found inside it,
    both relative to the current working directory and Gro's directory.
    So when you run `gro src` or simply `gro`,
    it'll print all tasks available both in your project and Gro.
