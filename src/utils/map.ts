export {mapsEqual} from './deepEqual.js';

export const sortMapByKey = <T extends Map<any, any>>(
	map: T,
	comparator = compareSimpleMapEntries,
): T => new Map([...map].sort(comparator)) as T;

export const compareSimpleMapEntries = (a: [any, any], b: [any, any]): number =>
	a[0] > b[0] ? 1 : -1;
