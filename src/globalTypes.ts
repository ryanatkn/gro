/*

These are convenient global types that can be used in both Gro and user code.
It probably makes more sense to give this file a `.d.ts` extension,
but that complicates the build because TypeScript does not output them.

TODO probably make this `.d.ts` when we make a proper build process

*/

declare type Falsy = false | '' | null | undefined | 0 | -0 | typeof NaN;

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

type Assignable<T, K extends keyof T = keyof T> = {
	-readonly [P in K]: T[P];
};

declare type Result<TValue = {}, TError = {}> = ({ok: true} & TValue) | ({ok: false} & TError);

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

declare module 'mri';

declare module 'kleur/colors' {
	type Colorize = (s: unknown) => string;

	export const $: {
		enabled: boolean;
	};

	// modifiers
	export const reset: Colorize;
	export const bold: Colorize;
	export const dim: Colorize;
	export const italic: Colorize;
	export const underline: Colorize;
	export const inverse: Colorize;
	export const hidden: Colorize;
	export const strikethrough: Colorize;

	// colors
	export const black: Colorize;
	export const red: Colorize;
	export const green: Colorize;
	export const yellow: Colorize;
	export const blue: Colorize;
	export const magenta: Colorize;
	export const cyan: Colorize;
	export const white: Colorize;
	export const gray: Colorize;
	export const grey: Colorize;

	// background colors
	export const bgBlack: Colorize;
	export const bgRed: Colorize;
	export const bgGreen: Colorize;
	export const bgYellow: Colorize;
	export const bgBlue: Colorize;
	export const bgMagenta: Colorize;
	export const bgCyan: Colorize;
	export const bgWhite: Colorize;
}

// TODO https://github.com/lukeed/uvu/pull/105
// experiment with the other types too!
declare module 'uvu/assert' {
	type Types = 'string' | 'number' | 'boolean' | 'object' | 'undefined' | 'function';

	export type Message = string | Error;
	export function ok(actual: any, msg?: Message): asserts actual;
	export function is(actual: any, expects: any, msg?: Message): void;
	export function equal(actual: any, expects: any, msg?: Message): void;
	export function type(actual: any, expects: Types, msg?: Message): void;
	export function instance(actual: any, expects: any, msg?: Message): void;
	export function snapshot(actual: string, expects: string, msg?: Message): void;
	export function fixture(actual: string, expects: string, msg?: Message): void;
	export function match(actual: string, expects: string | RegExp, msg?: Message): void;
	export function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
	export function not(actual: any, msg?: Message): void;
	export function unreachable(msg?: Message): void;

	export namespace is {
		function not(actual: any, expects: any, msg?: Message): void;
	}

	export namespace not {
		function ok(actual: any, msg?: Message): asserts actual is Falsy;
		function equal(actual: any, expects: any, msg?: Message): void;
		function type(actual: any, expects: Types, msg?: Message): void;
		function instance(actual: any, expects: any, msg?: Message): void;
		function snapshot(actual: string, expects: string, msg?: Message): void;
		function fixture(actual: string, expects: string, msg?: Message): void;
		function match(actual: string, expects: string | RegExp, msg?: Message): void;
		function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
	}

	export class Assertion extends Error {
		name: 'Assertion';
		code: 'ERR_ASSERTION';
		details: false | string;
		generated: boolean;
		operator: string;
		expects: any;
		actual: any;
		constructor(options?: {
			message: string;
			details?: string;
			generated?: boolean;
			operator: string;
			expects: any;
			actual: any;
		});
	}
}
