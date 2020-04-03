# options

Options to a function or constructor are an incredibly common pattern,
but their defaults and types are hard to get right.
Every pattern has tradeoffs of complexity, consistency, and type safety.

For cases where all options are required,
the options argument's type needs no special handling.
However when you need partials and defaults,
the codebase's conventions are documented below.

Gro uses a consistent options pattern that has one major (and weird) caveat:
**if an option can be `undefined`, it must default to `undefined`**.
All values that are `undefined` are omitted when the options are initialized
through use of the conventional `omitUndefined` helper.

This is slightly unfortunate, but it's a side-effect of the way
TypeScript makes optional properties, like those in `Partial<Options>`,
accept `undefined` as values in addition
to making the property existence optional.
See [this issue](https://github.com/Microsoft/TypeScript/issues/13195) for more.
The best workaround is probably `null`.

Example:

```ts
import {omitUndefined} from '../utils/object.js';

export interface Options {
	a: boolean;
	b: string | null;
	c: number | undefined;
}
export type RequiredOptions = 'a'; // or `'a' | 'b'` or `never`
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	// Required properties should not be included here,
	// because their values will always be overwritten.
	// a: true,

	// Preferring `null` over `undefined` bypasses this whole mess.
	b: null,

	// Because `c` can be `undefined`, it must default to `undefined`!
	c: undefined,

	// We always omit `undefined` values from the initial options
	// so callers can be assured type safety.
	// TypeScript allows `undefined` to be passed for optional properties
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
