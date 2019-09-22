import {deepEqual} from './deepEqual';

export const last = <T>(array: T[]): T | undefined => array[array.length - 1];

export const arraysEqual = (a: Array<any>, b: Array<any>): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!deepEqual(a[i], b[i])) return false;
	}
	return true;
};
