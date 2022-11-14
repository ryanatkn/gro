# task

> task runner for
> [Gro](https://github.com/feltcoop/gro)

## contents

- [what](#what)
- [usage](#usage)
- [future improvements](#future-improvements)
- [why?](#why)

## what

A Gro `Task` is just an object with a `run` function and some optional metadata.
Gro prefers conventions and code over configuration,
and its task runner leverages the filesystem as the API
and defers composition to the user in regular TypeScript modules.

- Gro automatically discovers [all `*.task.ts` files](../docs/tasks.md)
  in your source directory, so creating a new task
  is as simple as [creating a new file](#define-a-task), no config needed
- task definitions are just objects with an async `run` function and some optional properties,
  so composing tasks is explicit in your code, just like any other module
  (but there's also the helper `invokeTask`: see more below)
- on the command line, tasks replace the concept of commands,
  so running them is as simple as `gro <task>`,
  and in code the task object's `run` function has access to CLI args;
  to view [the available tasks](https://github.com/feltcoop/gro/blob/main/src/docs/tasks.md)
  run `gro` with no arguments
- it's easy to hook into or override any of Gro's builtin tasks,
  like [`gro test`](../test.task.ts) and [`gro gen`](../gen.task.ts)
  (tasks are copy-paste friendly! just update the imports)
- the task execution environment is filesystem agnostic by default; `run` receives a
  [`TaskContext` argument](#user-content-types-task-and-taskcontext) with an `fs` property
- the `TaskContext` provides a rich baseline context object
  for both development/build tasks and one-off script authoring/execution;
  it attempts to be portable and extensibile, but there's a _lot_ of room for improvement
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
> see [the `inputPaths` comments](../fs/inputPath.ts)

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

### task directories

As a convenience, Gro interprets `src/some/taskname/taskname.task.ts`
the same as `src/some/taskname.task.ts`,
so instead of running `gro some/taskname/taskname` you simply run `gro some/taskname`.
This is useful because tasks may have associated files (see the args docs below),
and putting them into a directory together can help make projects easier to navigate.

### types `Task` and `TaskContext`

```ts
// usage:
// import {type Task, type TaskContext} from '@feltcoop/gro';

export interface Task<TArgs = Args, TEvents = {}> {
	run: (ctx: TaskContext<TArgs, TEvents>) => Promise<unknown>;
	summary?: string; // prints as help text to the terminal
	dev?: boolean; // set to `false` to run the task and its children in production mode
	args?: ArgsSchema; // a JSON schema -- TODO this is currently a subset that requires `properties`
}

export interface TaskContext<TArgs = {}, TEvents = {}> {
	fs: Filesystem;
	dev: boolean;
	log: Logger;
	args: TArgs;
	events: StrictEventEmitter<EventEmitter, TEvents>;
	invokeTask: (
		taskName: string,
		args?: Args,
		events?: StrictEventEmitter<EventEmitter, TEvents>,
		dev?: boolean,
		fs?: Filesystem,
	) => Promise<void>;
}
```

### run a task inside another task with `invokeTask`

Because Gro tasks are just functions,
you can directly import them from within other tasks and run them.
However, we recommend using the `invokeTask` helper
for its ergonomics and automatic logging and diagnostics.

The `invokeTask` helper uses Gro's task resolution rules
to allow user code to override builtin tasks.
For example, Gro's `check.task.ts` calls `invokeTask('test')`
so that it calls your `src/test.task.ts` if it exists
and falls back to `gro/src/test.task.ts` if not.

It's less important to use `invokeTask` over explicit imports in user code
because you don't need to rely on the task override rules to get desired behavior,
but the logging and diagnostics it provides are nice to have.

```bash
gro some/file
```

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({args, invokeTask}) => {
		// runs `src/some/file.task.ts`, automatically forwarding `args`
		await invokeTask('some/file');
		// as documented above, the following is similar but lacks nice features:
		// await (await import('./some/file.task.js')).run(ctx);

		// runs `src/other/file.task.ts` and falls back to `gro/src/other/file.task.ts`,
		// forwarding both custom args and a different event emitter (warning: spaghetti)
		await invokeTask(
			'other/file',
			{...args, optionally: 'extended'},
			optionalEventEmitterForSubtree,
			optionalDevFlagForSubtree,
			optionalFsForSubtree,
		);

		// runs `gro/src/other/file.task.ts` directly, bypassing any local version
		await invokeTask('gro/other/file');
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
	run: async ({args, invokeTask}) => {
		await doSomethingFirst();
		// As discussed in the `invokeTask` section above,
		// it's possible to `import {task as groBuiltinTestTask} from '@feltcoop/gro/dist/test.task.js'`
		// and then call `groBuiltinTestTask.run` directly,
		// but that loses some important benefits.
		// Still, the task is available to import if you want it for any reason!
		await invokeTask('gro/test', {...args, optionally: 'extended'}, newEventEmitterForSubtree);
		await emailEveryoneWithTestResults();
	},
};
```

Note that when hooking into [Gro's builtin tasks](../docs/tasks.md),
like `test.task.ts` above, you don't have to call its version.
You can copy/paste an existing task and customize it,
rewrite a task from scratch, compose them together, or whatever is needed for each project.

### task `args`

The `Task` interface is generic, and its first param is the type of the task context `args`.

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task<{something: boolean}> = {
	run: async ({args}) => {
		args.something; // boolean
	},
};
```

The **`args` property** of each `Task` (not the task context **`args` param** described above!)
is an optional schema.
When combined with [Gro's schema generation](./gen.md#generate-typescript-types-from-schemas),
we can define a schema for the args and use it along with its generated type,
providing some benefits:

- print helpful text on the CLI with `gro` and `gro taskname --help`
- type safety with an automatically generated type
- args validation using the schema with initialized defaults

```ts
// src/dosomething.task.ts
import type {Task} from '@feltcoop/gro';

import {DosomethingArgsSchema} from './dosomethingTask.schema.js';
import type {DosomethingArgs} from './dosomethingTask.js'; // this is generated

export const task: Task<DosomethingArgs> = {
	args: DosomethingArgsSchema,
	run: async ({args}) => {
		args.yepyep; // string
		args.okcool; // number
		args.maybee; // boolean | undefined
	},
};
```

```ts
// src/dosomethingTask.schema.ts
import type {ArgsSchema} from '@feltcoop/gro';

export const DosomethingArgsSchema: ArgsSchema = {
	$id: '/schemas/DosomethingArgs.json',
	type: 'object',
	properties: {
		yepyep: {type: 'string', default: 'ya', description: 'helpful info'},
		okcool: {type: 'number', default: 1234, description: 'that prints to the CLI'},
		maybee: {type: 'boolean', description: 'and optional args work too'},
	},
	required: ['yepyep', 'okcool'],
};
```

```ts
// generated by src/dosomethingTask.schema.ts

export interface DosomethingArgs {
	/**
	 * helpful info
	 */
	yepyep: string;
	/**
	 * that prints to the CLI
	 */
	okcool: number;
	/**
	 * and optional args work too
	 */
	maybee?: boolean;
}

// generated by src/dosomethingTask.schema.ts
```

### task args forwarding

Some builtin Gro tasks call external commands like
[`svelte-kit`](https://github.com/sveltejs/kit),
[`vite`](https://github.com/vitejs/vite),
[`uvu`](https://github.com/lukeed/uvu),
[`tsc`](https://github.com/microsoft/typescript),
and [`prettier`](https://github.com/prettier/prettier).
Gro supports generic agnostic args forwarding to these tasks via the `--` pattern:
for example, to forward args to `svelte-kit` and `uvu`, no matter which task invokes them,
use `gro taskname --taskname-arg -- uvu --arg1 neat --arg2 22 -- svelte-kit --arg3`.

Any number of sections separated by `--` may be defined, and the first arg
that appears after each `--` is assumed to be the CLI command.
If `gro taskname` or its invoked tasks don't call `uvu` or `svelte-kit`,
the `--` args will be ignored.

There's one special case for task args forwarding: running Gro tasks.
If `gro` is the command following a `--`, e.g. the second `gro` of
`gro taskname -- gro taskname2 --a --b`,
then `--a` and `--b` will be forwarded to `taskname2`.
Forwarded args to Gro tasks override direct args, including args to `invokeTask`,
so `gro taskname --a 1 -- gro taskname --a 2` will invoke `taskname` with `{a: 2}`.

### task events

The `Task` interface's second generic parameter is `TEvents`
to type the `events` property of the `TaskContext`.
It uses Node's builtin `EventEmitter` with types provided by the types-only dependency
[`strict-event-emitter-types`](https://github.com/bterlson/strict-event-emitter-types/).

> Task events are designed as an escape hatch for cross-task communication.
> Use wisely! Using events like this can make code more difficult to comprehend.

Here's how a task can emit and listen to events:

```ts
// src/some/mytask.task.ts
import type {Task} from '@feltcoop/gro';

import {type TaskEvents as OtherTaskEvents} from '../task/othertask.task.ts';

export interface TaskArgs {}
export interface TaskEvents extends OtherTaskEvents {
	'mytask.data': (count: number, thing: string) => void;
}

export const task: Task<TaskArgs, TaskEvents> = {
	run: async ({events}) => {
		// `events` has type `StrictEventEmitter<EventEmitter, TaskEvents>`
		// see: https://github.com/bterlson/strict-event-emitter-types/
		events.emit('mytask.data', 2, 'params');

		// This is typed because we extended `TaskEvents` by another `othertask`'s events.
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

### `dev` forwarding through the task invocation tree

```ts
// src/some/file.task.ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	production: true, // task runner will spawn a new process if `process.env.NODE_ENV` isn't 'production'
	run: async ({dev, invokeTask}) => {
		// `dev` is `false` because it's defined two lines up in the task definition,
		// unless an ancestor task called `invokeTask` with a `true` value, like this:
		invokeTask('descendentTaskWithFlippedDevValue', undefined, undefined, !dev);
	},
};
```

## future improvements

- [ ] consider a pattern for declaring and validating CLI args

## why?

Gro usage on the command line (`gro <taskOrDirectory> [...flags]`)
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
- [npm scripts](https://docs.npmjs.com/cli/v8/using-npm/scripts)
