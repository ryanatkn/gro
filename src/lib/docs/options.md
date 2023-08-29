# options

Options to a function or constructor are an incredibly common pattern,
but their defaults and types are hard to get right.
Every pattern has tradeoffs of complexity, consistency, and type safety.

In most cases, we can keep it simple:

```ts
export const keepItSimple = (options: Options) => {
	const {requiredOption, optionalOption = 36} = options;
```

This works too, but it doesn't use `const`, so each variable can be reassigned.
We generally avoid rebinding (and even allowing it) except in particular circumstances.,
so you won't see this much in the codebase:

```ts
export const conciseButAllowsRebinding = ({requiredOption, optionalOption = 36}: Options) => {
```

In cases where we need the final `options` object --
for example when you need to pass it to other functions --
and in complex cases that benefit from more structure,
the codebase's conventions are documented below.
It's not the pattern for every circumstance;
there is overhead that e.g. hot paths and simple implementations should avoid.

> TODO should we rework this to stop using the `omitUndefined` helper?
> see `exactOptionalPropertyTypes` and the note below about it too

```ts
import {omitUndefined} from '@feltjs/util/object.js';

export interface Options {
	a: boolean;
	b: string | null;
	c: number | undefined; // `undefined` needs special handling! see below
}
export type RequiredOptions = 'a'; // or `'a' | 'b'` or `never`
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
// or the simpler case when there are no required options:
// export const initOptions = (opts: Partial<Options>): Options => ({
export const initOptions = (opts: InitialOptions): Options => ({
	// Required properties should not be included here,
	// because their values will always be overwritten.
	// a: true,

	// Preferring `null` over `undefined` bypasses this whole mess.
	b: null,

	// Because `c` can be `undefined`, it must default to `undefined`! and it's optional:
	// c: undefined,

	// We always omit `undefined` values from the initial options
	// so callers can be assured type safety.
	// TypeScript allows `undefined` to be passed for optional properties
	// (TODO this can now be customized with `exactOptionalPropertyTypes`
	// but we have it disabled for now)
	// (https://github.com/Microsoft/TypeScript/issues/13195),
	// allowing callers to pass `undefined` without TypeScript complaining and
	// override properties whose types don't include `undefined`, causing errors!
	// Omitting `undefined` here protects callers from mistakenly overriding
	// an optional property with an invalid `undefined` value,
	// but it also means callers can never override
	// a non-`undefined` default with `undefined`.
	// This is an unfortunate tradeoff in that it forces any value
	// that can be `undefined` to default to `undefined`,
	// but it's the best middle ground we've found so far.
	// It protects the caller at the cost
	// of complicating a module's internals.
	// This is a lot of documentation for a deceptively simple pattern,
	// but standardizing the conventions is a big win.
	// When possible, prefer `null` to `undefined` when designing options APIs.
	...omitUndefined(opts),

	// complicatedOverridingValueCanBeComputed: here(opts),
});

// use in a plain function
export const createThing = (opts: InitialOptions) => {
	const options = initOptions(opts);
};

// use in a class
export class Thing {
	readonly options: Options; // optionally store the reference
	constructor(opts: InitialOptions) {
		this.options = initOptions(opts);
	}
}
```

## caveats

Importantly, both of Gro's options patterns have one significant gotcha:
**if an option can be `undefined`, it must default to `undefined`**
to ensure type safety for callers.
All values that are `undefined` are omitted when the options are initialized
through use of the conventional `omitUndefined` helper.
The best workaround is to design options interfaces
to accept `null` in place of `undefined`.

This is slightly unfortunate, but it's a side-effect of the way
TypeScript makes optional properties, like those in `Partial<Options>`,
accept `undefined` as values in addition
to making the property existence optional.
For more, see the example below and
[this TypeScript issue](https://github.com/Microsoft/TypeScript/issues/13195).