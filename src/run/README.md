# run

> task runner for
> [`gro`](https://github.com/feltcoop/gro)

Gro's task runner uses conventions to make
defining and discovering tasks simple and easy.

- automatically discovers all `*.task.ts` files in your source directory
- task definitions are just async functions in TypeScript modules,
  so chaining and composition are explicit in your code with one exception -
  `run` will execute multiple tasks serially, awaiting any async ones
- it's fast because it imports only the modules that your chosen tasks need

## Usage

To show all available tasks:

```bash
$ gro run # looks through src/ for files matching *.task.ts and displays them
```

To run a specific task:

```bash
$ gro run path/to/action # runs src/path/to/action.task.ts
```

To run a series of tasks:

```bash
$ gro run task1 task2 task3 # each is awaited before moving to the next
```

## Future improvements

- [ ] integrate with the build process and watch mode
