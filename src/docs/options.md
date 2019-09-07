# options

Options to a function or constructor are an incredibly common pattern,
but their defaults and types are hard to get right.
Every pattern has tradeoffs of complexity and consistency.

`gro` uses a simple consistent pattern that has one major (and weird) caveat:
**if an option may be `undefined`, it must default to `undefined`**.
Any values that are `undefined` are omitted when the options are initialized.

This is slightly unfortunate, but it's a side-effect of the way
TypeScript makes optional properties, like those in `Partial<Options>`,
accept `undefined` as values in addition
to making the property existence optional.

Example:

```ts
export interface Options {
	a: boolean;
	b: string | null;
}
export type RequiredOptions = 'a';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	// Required properties should not be included here,
	// because their values will always be overwritten.
	// a: true, // <--- don't include! is misleading
	b: null,
	...omitUndefined(opts),
});
```
