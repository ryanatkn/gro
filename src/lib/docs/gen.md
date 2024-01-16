# gen

> automated codegen by convention for
> [Gro](https://github.com/ryanatkn/gro)

## motivation

The [`gro gen` task](/src/lib/gen.task.ts) helps us enhance our projects
with convention-based code/data/file generation (codegen) techniques.

Why? Codegen can produce cool results and unhalting pain.
Used well, codegen can improve performance, flexibility, consistency, and development speed.
As developers, automating our work is a natural thing to do,
and whether or not it's a wise thing to do,
`gro gen` can bring automation deeper into our code authoring workflows.

By convention, `gro gen` looks through `src/`
for any TypeScript files with `.gen.` in the file name,
and it outputs a file stripped of `.gen.` to the same directory.
The `*.gen.*` origin files export a `gen` function
More flexibility is available when needed
including multiple custom output files.

`gen` is implemented as [a task](/src/lib/gen.task.ts)
and [a plugin](/src/lib/gro_plugin_gen.ts),
and runs only during development, not for production builds.

Normally you'll want to commit generated files to git,
but you can always gitignore a specific pattern like `*.ignore.*`
and name the output files accordingly.

Integrating codegen into our development process
is a simple idea with vast potential.
It lets us have a single source of truth for data
without compromising any of our code's runtime characteristics.
We can generate documentation, types,
`index.ts` files exporting directories,
data for a UI,
validators, tests, fakes,
and more by introspecting our data at buildtime,
which speeds up development
The goal is to leverage automation to increase the power we wield over our code
with a straightforward developer experience.
Ergonomics are key to unlocking codegen's full potential.

**Be aware** — this is a sharp tool! It should be used sparingly, only when it's a clear win.
It adds a layer of indirection between the code you write and run,
and it's possible to tie yourself into knots with dependencies.
Also, you could introduce security vulnerabilities
if you fail to escape certain inputs,
There's no support for sourcemaps yet, and I have no plans for them.
(I would accept contributions, but I think it's a hard problem to do well,
and I don't know what the payoffs would be)

Inspirations include Lisp macros, the
[Svelte](https://github.com/sveltejs/svelte) compiler,
and [Zig](https://github.com/ziglang/zig)'s comptime.
(but `gro gen` is far more primitive)

## usage

The `gro gen` task looks for any files with `.gen.`
in the file name and tries to call an exported `gen`
function to generate one or more output files,
and then it writes the results to the filesystem.

```bash
gro gen # runs codegen for all *.gen.* files in src/
gro gen --check # exits with error code 1 if anything is new or different; no-op to the fs
```

> in the following examples,
> but it makes for a better DX

### generate arbitrary TypeScript

Given `src/script.gen.ts`:

```ts
import type {Gen} from '@ryanatkn/gro';

export const gen: Gen = () => {
	const message = 'generated';
	return `console.log('${message} a ${typeof message}')`;
};
```

Outputs `src/script.ts`:

```ts
console.log('generated a string');
```

### generate other filetypes

Files with any extension can be generated without configuration.
If the origin file name ends with the pattern `.gen.*.ts`,
the default output file name is stripped of its trailing `.ts`.

Given `src/markup.gen.html.ts`:

```ts
import type {Gen} from '@ryanatkn/gro';

export const gen: Gen = () => {
	const body = 'hi';
	return `
		<!DOCTYPE html>
		<html>
			<body>
				${body}
			</body>
		</html>
	`;
};
```

Outputs `src/markup.html`:

```html
<!doctype html>
<html>
	<body>
		hi
	</body>
</html>
```

### generate a custom file name or write to a different directory

The `gen` function can return an object with custom configuration.

Given `src/somewhere/originalName.gen.ts`:

```ts
import type {Gen} from '@ryanatkn/gro';

export const gen: Gen = () => {
	const message = 'output path can be relative and name can be anything';
	return {
		content: `console.log('${message}')`,
		filename: '../elsewhere/otherName.ts',
		format: optional_boolean_that_defaults_to_true,
	};
};
```

Outputs `src/elsewhere/otherName.ts`:

```ts
console.log('output path can be relative and name can be anything');
```

### generate multiple custom files

The `gen` function can also return an array of files.

Given `src/thing.gen.ts`:

```ts
import type {Gen} from '@ryanatkn/gro';

export const gen: Gen = () => {
	const fieldValue = 1;
	return [
		{
			content: `
				import {Thing} from './index';
				export const isThing = (t: any): t is Thing => t?.field === ${fieldValue};
			`,
		},
		{
			content: `export interface Thing { field: ${typeof fieldValue} }`,
			filename: 'types.ts',
		},
		{
			content: `{"field": ${fieldValue}}`,
			filename: 'data/thing.json',
		},
	];
};
```

Outputs `src/thing.ts`:

```ts
import type {Thing} from './index.js';
export const isThing = (t: any): t is Thing => t?.field === 1;
```

and `src/types.ts`:

```ts
export interface Thing {
	field: number;
}
```

and `src/data/thing.json`:

```json
{
	"field": 1
}
```

It's often helpful to check if any generated files are new or have changed.
We don't want to forget to regenerate files before committing or publishing!
The `check` CLI argument can be passed to perform this check
instead of writing the generated files to disk.

```bash
gro gen --check # exits with error code 1 if anything is new or different; no-op to the fs
```

or in code:

```ts
import type {Task} from '@ryanatkn/gro';

export const task: Task = {
	run: async ({args, invoke_task}) => {
		// this throws a `Task_Error` if anything is new or different
		await invoke_task('gen', {...args, check: true});
	},
};
```

Gro uses this in [`check.task.ts`](/src/lib/check.task.ts)
which is called during `gro publish`, and it's recommended in CI.
(see [Gro's example `check.yml`](/.github/workflows/check.yml))

## todo

- [x] basic functionality
- [x] format output with Prettier
- [x] [watch mode and build integration](https://github.com/ryanatkn/gro/pull/283),
      opt out with `watch: false` for expensive gen use cases
- [ ] change the exported `gen` function to an object with a `summary` and other properties like `watch`
- [ ] support generating non-text files
- [ ] think about how to handle gen file dependency graphs (generated files as inputs to gen files)
