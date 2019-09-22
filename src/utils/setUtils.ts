import {arraysEqual} from './arrayUtils.js';

// TODO gives false negatives for values that don't compare with `>`
// TODO speed this up? benchmark!
export const setsEqual = (
	a: Set<unknown>,
	b: Set<unknown>,
	comparator = compareSimpleValues,
): boolean => {
	if (a.size !== b.size) return false;
	return arraysEqual(
		Array.from(a.values()).sort(comparator),
		Array.from(b.values()).sort(comparator),
	);
};

const compareSimpleValues = (a: any, b: any) => (a > b ? 1 : -1);
