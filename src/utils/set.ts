import {deepEqual} from './deepEqual.js';

export const setsEqual = (a: Set<unknown>, b: Set<unknown>): boolean => {
	if (a.size !== b.size) return false;
	let eq = false;
	for (const aVal of a) {
		if (b.has(aVal)) continue;
		eq = false;
		for (const bVal of b) {
			if (deepEqual(aVal, bVal)) {
				eq = true;
				break;
			}
		}
		if (!eq) return false;
	}
	return true;
};
