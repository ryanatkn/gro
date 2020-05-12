import {arraysEqual} from './array.js';

// TODO speed this up? benchmark!
export const mapsEqual = (a: Map<any, any>, b: Map<any, any>): boolean => {
	if (a.size !== b.size) return false;
	return arraysEqual([...a], [...b]);
};
