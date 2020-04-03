# run

> task runner for
> [`gro`](https://github.com/feltcoop/gro)

Gro's task runner uses conventions to define and discover tasks.
It prefers code over configuration.

Some highlights:

- automatically discovers all `*.task.ts` files in your source directory
- task definitions are just async functions in TypeScript modules,
  so chaining and composition are explicit in your code with one exception -
  `gro run` executes multiple tasks serially, awaiting any async ones
- passes a shared data object through each task
  which can mutated or kept immutable - be careful with mutation!
- it's fast because it imports only the modules that your chosen tasks need

## usage

To show all available tasks:

```bash
$ gro run # looks through src/ for files matching *.task.ts and displays them
```

Define a task:

```ts
// src/some/thing.task.ts
import {Task} from 'gro/run/task.js';

export const task: Task = {
	run: async ({log}, data) => {
		log.info('hi!');
		await somethingAsync(data.isPassedFromTaskToTask);
		return {...data, newData: 'can go here'};
	},
};
```

To run a specific task:

```bash
$ gro run some/thing # runs src/some/thing.task.ts
```

To run a series of tasks:

```bash
$ gro run task1 task2 task3 # each is awaited before moving to the next
```

## future improvements

- [ ] integrate with the build process and watch mode
- [ ] consider simplifying the task definition -
      it could be a single function if the object syntax
      ends up not being useful for task metadata,
      and it could be changed to be a default export
