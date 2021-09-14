# gen

> automated codegen by convention for
> [Gro](https://github.com/feltcoop/gro)

**note**: this is one of the more experimental parts of Gro, and significant changes are planned

## motivation

The `gro gen` task helps us enhance our projects
with convention-based code/data/file generation (codegen) techniques.

Why? Codegen can produce cool results and eternal pain.
Used well, codegen can improve performance, flexibility, consistency, and development speed.
As developers, automating our work is a natural thing to do,
and whether or not it's a wise thing to do,
`gro gen` can bring automation deeper into our code authoring workflows.

By convention, `gro gen` looks through `src/`
for any TypeScript files with `.gen.` in the file name,
and it outputs a file stripped of `.gen.` to the same directory.
The `*.gen.*` origin files export a `gen` function
that returns the content of the output file.
More flexibility is available when needed
including multiple custom output files.

Normally you'll want to commit generated files to git,
but you can always gitignore a specific pattern like `*.ignore.*`
and name the output files accordingly.
We may want to smooth out this use case in the future.

Integrating codegen into our development process
is a simple idea with vast potential.
It lets us have a single source of truth for data
that would otherwise be scattered throughout our codebases
without compromising any of our code's runtime characteristics.
We can generate documentation, types, validators, tests, fakes,
and more by introspecting our data at buildtime,
which speeds up development
and helps us write code that's easier to understand and change.
The goal is to leverage automation to increase the power we wield over our code
with a straightforward developer experience.
Ergonomics are key to unlocking codegen's full potential.

**Be aware** — this is a sharp tool!
It adds a layer of indirection between the code you write and run.
Also, you could introduce security vulnerabilities
if you fail to escape certain inputs.
Importantly, there is no support for sourcemaps right now.
Sourcemaps could be added at some point, at least in many cases.

Inspirations include Lisp macros, the
[Svelte](https://github.com/sveltejs/svelte) compiler,
and [Zig](https://github.com/ziglang/zig)'s comptime.
(but `gen` is far more primitive)

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
> note that importing the `Gen` type is optional,
> but it makes for a better DX

### generate TypeScript

Given `src/script.gen.ts`:

```ts
import {Gen} from '@feltcoop/gro';

export const gen: Gen = () => {
	const message = 'generated!';
	return `console.log('${message}')`;
};
```

Outputs `src/script.ts`:

```ts
console.log('generated!');
```

### generate other filetypes

Files with any extension can be generated without configuration.
If the origin file name ends with the pattern `.gen.*.ts`,
the default output file name is stripped of its trailing `.ts`.
Given `src/markup.gen.html.ts`:

```ts
import {Gen} from '@feltcoop/gro';

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
<!DOCTYPE html>
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
import {Gen} from '@feltcoop/gro';

export const gen: Gen = () => {
	const message = 'output path can be relative and name can be anything';
	return {
		content: `console.log('${message}')`,
		filename: '../elsewhere/otherName.ts',
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
import {Gen} from '@feltcoop/gro';

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
import {Thing} from './index.js';
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

### check that generated files have not changed

It's often helpful to check if any generated files are new or have changed.
We don't want to forget to regenerate files before committing or publishing!
The `check` CLI argument can be passed to perform this check
instead of writing the generated files to disk.

```bash
gro gen --check # exits with error code 1 if anything is new or different; no-op to the fs
```

or in code:

```ts
import type {Task} from '@feltcoop/gro';

export const task: Task = {
	run: async ({args, invoke_task}) => {
		// this throws a `TaskError` if anything is new or different
		await invoke_task('gen', {...args, check: true});
	},
};
```

Gro uses this in [`check.task.ts`](../check.task.ts)
which is called in the npm [`"preversion"`](../../package.json) script.

## todo

- [x] basic functionality
- [x] format output with Prettier
- [ ] change the exported `gen` function to an object with a `summary` and other properties like `watch`
- [ ] watch mode and build integration, opt out with `watch: false` for expensive gen use cases
- [ ] assess libraries for generating types
- [ ] support gen files authored in languages beyond TypeScript like
      Svelte/[MDSveX](https://github.com/pngwn/MDsveX)/etc
      to generate html/markdown/etc
- [ ] support generating non-text files
- [ ] sourcemaps
