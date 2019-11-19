export const regexpsEqual = (a: RegExp, b: RegExp): boolean =>
	a.source === b.source && a.flags === b.flags;
