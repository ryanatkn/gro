# task

> task runner for
> [Gro](https://github.com/feltcoop/gro)

## contents

- [what](#what)
- [usage](#usage)
- [future improvements](#future-improvements)
- [why?](#why)

## what

A Gro task is just a function with some optional metadata.
Gro prefers conventions and code over configuration,
and its task runner leverages the filesystem as the API
and defers composition to the user in regular TypeScript modules.

- Gro automatically discovers [all `*.task.ts` files](../docs/tasks.md)
  in your source directory, so creating a new task is as simple as creating a new file -
  no configuration or scaffolding commands needed!
- task definitions are just objects with an async `run` function and some optional properties,
  so composing tasks is explicit in your code, just like any other module
  (but there's also the helper `invoke_task`: see more below)
- on the command line, tasks replace the concept of commands,
  so running them is as simple as `gro <task>`,
  and in code the task object's `run` function has access to CLI args
- it's easy to hook into or override any of Gro's builtin tasks,
  like [`gro test`](../test.task.ts) and [`gro gen`](../gen.task.ts)
  (tasks are copy-paste friendly! just update the imports)
- the task execution environment is filesystem agnostic by default; `run` receives a
  [`Task_Context` argument](#user-content-types-task-and-taskcontext) with an `fs` property
- the `Task_Context` provides a rich baseline context object
  for both dev env and one-off script authoring and execution,
  enriching the APIs of both Gro and userland with its portable and extensibile affordances
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
# If no tasks are found, it displays an error.
$ gro some/dir
```

> To learn more about the Gro CLI path conventions,
> see [the `input_paths` comments](../fs/input_path.ts)

### run a task

```bash
# This runs `src/some/file.task.ts`,
# or if it doesn't exist, `gro/src/some/file.task.ts`.
# If neither exists, it displays an error.
$ gro some/file arg1 arg2 --arg3 example

# This runs `gro/src/some/file.task.ts` directly
# without checking the current working directory,
# and displays an error if it doesn't exist.
$ gro gro/some/file
```

### define a task

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({log, args}) => {
		log.info('CLI args', args); // => {_: ['arg1', 'arg2'], arg3: 'example'}
		await whatever();
	},
};
```

### types `Task` and `Task_Context`

```ts
// usage:
// import type {Task, Task_Context} from '@feltcoop/gro';

export interface Task<T_Args = Args, T_Events = {}> {
	run: (ctx: Task_Context<T_Args, T_Events>) => Promise<unknown>;
	summary?: string;
	dev?: boolean; // set to `false` to run the task and its children in production mode
}

export interface Task_Context<T_Args = {}, T_Events = {}> {
	fs: Filesystem;
	dev: boolean;
	log: Logger;
	args: T_Args;
	events: StrictEventEmitter<EventEmitter, T_Events>;
	invoke_task: (
		task_name: string,
		args?: Args,
		events?: StrictEventEmitter<EventEmitter, T_Events>,
		dev?: boolean,
		fs?: Filesystem,
	) => Promise<void>;
}
```

### run a task inside another task with `invoke_task`

Because Gro tasks are just functions,
you can directly import them from within other tasks and run them.
However, we recommend using the `invoke_task` helper
for its ergonomics and automatic logging and diagnostics.

The `invoke_task` helper uses Gro's task resolution rules
to allow user code to override builtin tasks.
For example, Gro's `check.task.ts` calls `invoke_task('test')`
so that it calls your `src/test.task.ts` if it exists
and falls back to `gro/src/test.task.ts` if not.

It's less important to use `invoke_task` over explicit imports in user code
because you don't need to rely on the task override rules to get desired behavior,
but the logging and diagnostics it provides are nice to have.

```bash
gro some/file
```

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({args, invoke_task}) => {
		// runs `src/some/file.task.ts`, automatically forwarding `args`
		await invoke_task('some/file');
		// as documented above, the following is similar but lacks nice features:
		// await (await import('./some/file.task.js')).run(ctx);

		// runs `src/other/file.task.ts` and falls back to `gro/src/other/file.task.ts`,
		// forwarding both custom args and a different event emitter (warning: spaghetti)
		await invoke_task('other/file', {...args, optionally: 'extended'}, newEventEmitterForSubtree);

		// runs `gro/src/other/file.task.ts` directly, bypassing any local version
		await invoke_task('gro/other/file');
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
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({args, invoke_task}) => {
		await doSomethingFirst();
		// As discussed in the `invoke_task` section above,
		// it's possible to `import {task as groBuiltinTestTask} from '@feltcoop/gro/dist/test.task.js'`
		// and then call `groBuiltinTestTask.run` directly,
		// but that loses some important benefits.
		// Still, the task is available to import if you want it for any reason!
		await invoke_task('gro/test', {...args, optionally: 'extended'}, newEventEmitterForSubtree);
		await emailEveryoneWithTestResults();
	},
};
```

Note that when hooking into [Gro's builtin tasks](../docs/tasks.md),
like `test.task.ts` above, you don't have to call its version.
You can copy/paste an existing task and customize it,
rewrite a task from scratch, compose them together, or whatever is needed for each project.

### task arg types

The `Task` interface is generic. Its first param is the type of the task context `args`.

Some Gro tasks use a value mapping pattern convention that we tentatively recommend:

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

import {Task_Args as OtherTask_Args} from './other.task.js';

export interface Task_Args extends OtherTask_Args {
	mapSomething: (thing: string) => string;
	// this is provided by `OtherTask_Args`:
	// mapSomeNumber: (other: number) => number;
}

export const task: Task<Task_Args> = {
	run: async ({args}) => {
		// `args` has type `Task_Args`

		// other tasks can assign args that this task consumes:
		const somethingcooler = args.mapSomething('somethingcool');

		// and this task can provide args for others:
		args.mapSomeNumber = (n) => n * ((1 + Math.sqrt(5)) / 2);
	},
};
```

### task events

The `Task` interface's second generic parameter is `T_Events`
to type the `events` property of the `Task_Context`.
It uses Node's builtin `EventEmitter` with types provided by the types-only dependency
[`strict-event-emitter-types`](https://github.com/bterlson/strict-event-emitter-types/).

Here's how a task can emit and listen to events:

```ts
// src/some/mytask.task.ts
import type {Task} from '@feltcoop/gro';

import type {Task_Events as OtherTask_Events} from './othertask.task.ts';

export interface Task_Args {}
export interface Task_Events extends OtherTask_Events {
	'mytask.data': (count: number, thing: string) => void;
}

export const task: Task<Task_Args, Task_Events> = {
	run: async ({events}) => {
		// `events` has type `StrictEventEmitter<EventEmitter, Task_Events>`
		// see: https://github.com/bterlson/strict-event-emitter-types/
		events.emit('mytask.data', 2, 'params');

		// This is typed because we extended `Task_Events` by another `othertask`'s events.
		// Other listeners and providers can be upstream or downstream of this task.
		events.once('othertask.eventname', (some: string, things: boolean, rock: object) => {});
	},
};
```

### throwing errors

If a task encounters an error, normally it should throw rather than exiting the process.
This defers control to the caller, like your own parent tasks.

> TODO add support for `FatalError`

Often, errors that tasks encounter do not need a stack trace,
and we don't want the added noise to be logged.
To suppress logging the stack trace for an error,
throw a `Task_Error`.

```ts
import {Task, Task_Error} from '@feltcoop/gro';

export const task: Task = {
	run: async () => {
		if (someErrorCondition) {
			throw new Task_Error('We hit a known error - ignore the stack trace!');
		}
	},
};
```

### `dev` forwarding through the task invocation tree

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	dev: false, // tell the task runner to set `dev` to false, updating `process.env.NODE_ENV`
	run: async ({dev, invoke_task}) => {
		// `dev` is `false` because it's defined two lines up in the task definition,
		// unless an ancestor task called `invoke_task` with a `true` value, like this:
		invoke_task('descendentTaskWithFlippedDevValue', undefined, undefined, !dev);
	},
};
```

## future improvements

- [ ] consider a pattern for declaring and validating CLI args

## why?

Gro usage on the command line (`gro <task_or_directory> [...flags]`)
looks a lot like using `node`.
What makes Gro different?

- The `*.task.ts` file name convention signals to Gro that your application
  contains task modules that conform to some interface.
  This allows them to be discoverable and puts generic handles on them,
  enabling various verbs (e.g. "run") and
  structured metadata (e.g. "summary").
- Tasks can be imported, inspected, combined, and manipulated in code.
  Task modules do not have any side effects when imported,
  while Node scripts just execute when imported -
  their primary purpose is to cause side effects.
- Module resolution differs:
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
  - The trailing `.task.ts` in the file path provided to `gro` is optional,
    so for example, `gro foo/bar` is the same as `gro foo/bar.task.ts`.

## :turtle:<sub>:turtle:</sub><sub><sub>:turtle:</sub></sub>

Gro's task runner has many inspirations:

- [mgutz/task](https://github.com/mgutz/task)
- [Gulp](https://github.com/gulpjs/gulp)
- [@mgutz](https://github.com/mgutz)' [Projmate](https://github.com/projmate/projmate-core)
- [Grunt](https://github.com/gruntjs/grunt)
