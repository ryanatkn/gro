# run

> task runner for
> [`gro`](https://github.com/feltcoop/gro)

Gro's task runner uses conventions to make
defining and discovering tasks simple and easy.

- automatically discovers all `*.task.ts` files in your source directory
- task definitions are just async functions in TypeScript modules,
  so chaining and composition are explicit in your code with one exception -
  `gro run` will execute multiple tasks serially, awaiting any async ones
- it's fast because it imports only the modules that your chosen tasks need

## Usage

To show all available tasks:

```bash
$ gro run # looks through src/ for files matching *.task.ts and displays them
```

Define a task:

```ts
// src/some/thing.task.ts
import {Task} from 'gro/run/task.js';
export const task: Task = {
	run: async ({log}) => {
		log.info('hi!');
		await somethingAsync();
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

## Future improvements

- [ ] integrate with the build process and watch mode
