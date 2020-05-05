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
