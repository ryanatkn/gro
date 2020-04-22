# run

> task runner for
> [Gro](https://github.com/feltcoop/gro)

Gro's task runner uses conventions to define and discover tasks.
It prefers code over configuration.

- automatically discovers all `*.task.ts` files in your source directory
- task definitions are just async functions in TypeScript modules,
  so chaining and composition are explicit in your code
- it's fast because it imports only the modules that your chosen tasks need

## usage

Show all available tasks:

```bash
$ gro run # looks through src/ for files matching *.task.ts and displays them
```

Run a task:

```bash
$ gro run some/thing arg1 arg2 --arg3 example # runs src/some/thing.task.ts
```

Define a task:

```ts
// src/some/thing.task.ts
import {Task} from '@feltcoop/gro/run/task.js';

export const task: Task = {
	run: async ({log, args}) => {
		log.info('CLI args', args); // => {_: ['arg1', 'arg2'], arg3: 'example'}
		await whatever();
	},
};
```

## future improvements

- [ ] integrate with the build process and watch mode
- [ ] consider a pattern for declaring and validating CLI args
