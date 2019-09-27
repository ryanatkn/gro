import {arraysEqual} from './array.js';

// TODO gives false negatives with keys that don't compare with `>`
// TODO speed this up? benchmark!
export const mapsEqual = (
	a: Map<any, any>,
	b: Map<any, any>,
	comparator = compareSimpleMapKeys,
): boolean => {
	if (a.size !== b.size) return false;
	return arraysEqual(
		Array.from(a.entries()).sort(comparator),
		Array.from(b.entries()).sort(comparator),
	);
};

const compareSimpleMapKeys = (a: [any, any], b: [any, any]) =>
	a[0] > b[0] ? 1 : -1;
