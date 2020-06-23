import {UnreachableError} from './error.js';

export const deepEqual = (a: unknown, b: unknown): boolean => {
	if (Object.is(a, b)) return true;

	const aType = typeof a;
	const bType = typeof b;

	if (aType !== bType) return false;

	switch (aType) {
		case 'string':
		case 'number':
		case 'bigint':
		case 'boolean':
		case 'symbol':
		case 'undefined':
		case 'function':
			return false;
		case 'object':
			if (a === null) return b === null;
			if (b === null) return a === null;

			// TODO might want to duck-type Array-likes to speed up e.g. typed array checking

			if (a instanceof Array) {
				if (!(b instanceof Array)) return false;
				return arraysEqual(a, b);
			}
			if (a instanceof Set) {
				if (!(b instanceof Set)) return false;
				return setsEqual(a, b);
			}
			if (a instanceof Map) {
				if (!(b instanceof Map)) return false;
				return mapsEqual(a, b);
			}
			if (a instanceof RegExp) {
				if (!(b instanceof RegExp)) return false;
				return regexpsEqual(a, b);
			}

			return objectsEqual(a as object, b as object);
		default:
			throw new UnreachableError(aType);
	}
};

export const objectsEqual = (a: object, b: object): boolean => {
	const aKeys = Object.keys(a);
	if (aKeys.length !== Object.keys(b).length) return false;
	for (const key of aKeys) {
		if (!(key in b)) return false;
		if (!deepEqual((a as any)[key], (b as any)[key])) return false;
	}
	return true;
};

export const arraysEqual = (a: Array<any>, b: Array<any>): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!deepEqual(a[i], b[i])) return false;
	}
	return true;
};

// Two sets containing deeply equal objects, but different references,
// are considered not equal to each other.
export const setsEqual = (a: Set<unknown>, b: Set<unknown>): boolean => {
	if (a.size !== b.size) return false;
	for (const aVal of a) {
		if (!b.has(aVal)) return false;
	}
	return true;
};

export const mapsEqual = (a: Map<any, any>, b: Map<any, any>): boolean => {
	if (a.size !== b.size) return false;
	return arraysEqual([...a], [...b]);
};

export const regexpsEqual = (a: RegExp, b: RegExp): boolean =>
	a.source === b.source && a.flags === b.flags;
