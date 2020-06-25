/*

These are convenient global types that can be used in both Gro and user code.
It probably makes more sense to give this file a `.d.ts` extension,
but that complicates the build because TypeScript does not output them.

TODO probably make this `.d.ts` when we make a proper build process

*/

declare type Obj<T = any> = {[key: string]: T};

declare type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// these were thrown together quickly - is there a better way to do this?
// there are probably better names for them!
// see `Required`, `Exclude` and `Extract` for possible leads for improvements
declare type PartialExcept<T, K extends keyof T> = {[P in K]: T[P]} &
	{[P in Exclude<keyof T, K>]?: T[P]};
declare type PartialOnly<T, K extends keyof T> = {[P in K]?: T[P]} &
	{[P in Exclude<keyof T, K>]: T[P]};

declare type PartialValues<T> = {
	[P in keyof T]: Partial<T[P]>;
};

/*

The `Flavored` and `Branded` type helpers add varying degrees of nominal typing to other types.
This is especially useful with primitives like strings and numbers.

```ts
type PhoneNumber = Branded<string, 'PhoneNumber'>;
const phone1: PhoneNumber = 'foo'; // error!
const phone2: PhoneNumber = 'foo' as PhoneNumber; // ok
```

`Flavored` is a looser form of `Branded` that trades safety for ergonomics.
With `Flavored` you don't need to cast unflavored types:

```ts
type Email = Flavored<string, 'Email'>;
const email1: Email = 'foo'; // ok
type Address = Flavored<string, 'Address'>;
const email2: Email = 'foo' as Address; // error!
```

*/
declare type Branded<TValue, TName> = TValue & Brand<TName>;
declare type Flavored<TValue, TName> = TValue & Flavor<TName>;
declare interface Brand<T> {
	readonly [BrandedSymbol]: T;
}
declare interface Flavor<T> {
	readonly [FlavoredSymbol]?: T;
}
declare const BrandedSymbol: unique symbol;
declare const FlavoredSymbol: unique symbol;
