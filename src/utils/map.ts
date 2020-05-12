import {arraysEqual} from './array.js';

// TODO speed this up? benchmark!
export const mapsEqual = (a: Map<any, any>, b: Map<any, any>): boolean => {
	if (a.size !== b.size) return false;
	return arraysEqual([...a], [...b]);
};

export const sortMapByKey = <T extends Map<any, any>>(
	map: T,
	comparator = compareSimpleMapEntries,
): T => new Map([...map].sort(comparator)) as T;

export const compareSimpleMapEntries = (a: [any, any], b: [any, any]): number =>
	a[0] > b[0] ? 1 : -1;
