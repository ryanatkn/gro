# gen

> code generation for `gro`

## motivation

The `gro gen` command allows us to enhance our projects
with convention-based code generation (codegen) techniques.

Why? Codegen can produce game-changing results for UX and DX,
especially around performance and flexibility.
As developers, automating our work is a natural and indispensable power,
and `gro gen` brings automation deeper into our code authoring workflows.

By convention, `gro gen` looks for any TypeScript files
with `.gen.` in the file name,
and it outputs a file stripped of `.gen.`.
The contents of the written file are returned as a string from
a `gen` function that's exported in the source `.gen.` file.
More flexibility is available when needed,
including custom file names and multiple output files.

The implications of integrating codegen into our code authoring are deep.
One benefit is that it allows us to have a single source of truth for data
that would otherwise be scattered throughout our codebases
across many types of files (like JSON, HTML, SQL, etc),
without compromising any of our code's runtime characteristics.
We can also generate types, validators, tests,
and more by introspecting our data at buildtime.
The goal is to leverage automation to increase the power we wield over our code
with the simplest possible developer affordances.

Inspirations include Lisp macros and
[Svelte](https://github.com/sveltejs/svelte), a compiler for building UIs.
Svelte is the UI library integrated in
[`gro`](https://github.com/ryanatkn/gro), `gen`'s parent project.

**Be aware** — this is a sharp tool!
It adds a layer of indirection between the code you write and run.
Importantly, there is no support for source maps right now.
Source maps could be added at some point, at least in many cases.

## todo

- [x] basic functionality
- [ ] By default, should output files be written to
      the same directory as the source file?
      Currently the output is written to the `build/` directory and
      is therefore not committed to source control.
      Maybe the convention should be to commit generated files,
      except in cases where the generated code is extremely large?
- [ ] in dev mode, add a header with the source file path
      when possible (e.g. JSON doesn't support comments)
- [ ] format output with Prettier
- [ ] watch mode and build integration
- [ ] look into leveraging
      [`io-ts-codegen`](https://github.com/gcanti/io-ts-codegen)
      or something similar to output TypeScript from JSON Schema
      (this probably belongs in user code, not `gro gen` itself)
- [ ] source maps

## usage

The `gro gen` command looks for any files with `.gen.`
in the file name and tries to call an exported `gen`
function to generate one or more output files.

```bash
gro gen
```

> in the following examples,
> note that importing the `Gen` type is optional,
> but it makes for a better DX

### generate JS

Given `src/script.gen.ts`:

```ts
import {Gen} from 'gro';

export const gen: Gen = () => {
	const message = 'generated!';
	return `console.log('${message}')`;
};
```

Outputs `build/script.js`:

```js
console.log('generated!');
```

### generate a file with an arbitrary extension

Given `src/markup.gen.html.ts`:

```ts
import {Gen} from 'gro';

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

Outputs `build/markup.html`:

```html
<!DOCTYPE html>
<html>
	<body>
		hi
	</body>
</html>
```

### output alongside the source file

Use the flag `outputToSource` to write the files to
the source file's directory instead of the build directory.

Given `src/data.gen.json.ts`:

```ts
import {Gen} from 'gro';

export const gen: Gen = () => {
	const data = true;
	return {
		content: `{"data": ${data}}`,
		outputToSource: true,
	};
};
```

Outputs `src/data.json`:

```json
{"data": true}
```

### generate multiple arbitrary files

Given `src/multi.gen.ts`:

```ts
import {Gen} from 'gro';

export const gen: Gen = () => {
	const fieldValue = 1;
	return [
		{
			contents: `export interface Data { field: ${typeof fieldValue} }`,
			fileName: 'types.ts',
			outputToSource: true,
		},
		{contents: `{"field": ${fieldValue}}`, fileName: 'data.json'},
	];
};
```

Outputs both `src/types.ts`:

```ts
export interface Data {
	field: number;
}
```

and `build/data.json`:

```json
{
	"field": 1
}
```
