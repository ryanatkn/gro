/*

This is a higher order function that
counts the number of obtained references to a thing
and calls `release` when the count drops to zero.

It allows decoupled consumers to use things with a lifecycle
without disrupting each other when they're done with the thing.

The motivating use case was reusing a database connection across multiple tasks.

See the tests for usage examples - ./createObtainable.test.ts

A future improvement could have `release` always return a promise
that resolves when the obtainable is fully released.

*/
export const createObtainable = <T>(
	obtain: () => T,
	release: (obtainable: T) => void,
): (() => [T, () => void]) => {
	let count = 0;
	let obtainable: T | undefined;
	const releaseObtainable = () => {
		count--;
		if (count > 0) return;
		const releasedResource = obtainable;
		obtainable = undefined; // reset before releasing just in case release re-obtains
		release(releasedResource!);
	};
	return () => {
		count++;
		if (obtainable === undefined) {
			obtainable = obtain();
			if (obtainable === undefined) {
				// this prevents `obtain` from being called multiple times,
				// which would cause bugs if it has side effects
				throw Error('Obtainable value cannot be undefined - use null instead.');
			}
		}
		return [obtainable, releaseObtainable];
	};
};
