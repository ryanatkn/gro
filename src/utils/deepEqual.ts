import {UnreachableError} from './errorUtils.js';
import {arraysEqual} from './arrayUtils.js';
import {objectsEqual} from './objectUtils.js';
import {mapsEqual} from './mapUtils.js';
import {setsEqual} from './setUtils.js';

// This is NOT a comprehensive `deepEqual`,
// but I don't want to take on the bulk
// of a 2000 line `loadsh` function or the 10 deps of `deep-equal`.

// TODO benchmark!

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

			// TODO what other types should be supported?
			// maybe look for array-like w/ length and assume indexing works?

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

			return objectsEqual(a as object, b as object);
		default:
			throw new UnreachableError(aType);
	}
};
