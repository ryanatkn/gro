# options

Options to a function or constructor are an incredibly common pattern,
but their defaults and types are hard to get right.
Every pattern has tradeoffs of complexity and consistency.

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
export type RequiredOptions = 'a'; // 'a' | 'otherRequiredOptionName'
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	// Required properties should not be included here,
	// because their values will always be overwritten.
	// a: true,

	b: null,

	// Because `c` can be `undefined`, it must default to `undefined`!
	// See the notes above for more.
	c: undefined,

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
