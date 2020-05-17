/*

This is a higher order function that
counts the number of obtained references to a thing
and calls `release` when the count drops to zero.

It allows decoupled consumers to use things with a lifecycle
without disrupting each other when they're done with the thing.

The motivating use case was reusing a database connection across multiple tasks.

See the tests for usage examples - ./createObtainable.test.ts

*/
export const createObtainable = <T>(
	obtain: () => T,
	release: (obtainable: T) => void,
): (() => [T, () => Promise<void>]) => {
	let count = 0;
	let obtainable: T | undefined;
	let resolve: () => void;
	let promise: Promise<void>;
	const releaseObtainable = (): Promise<void> => {
		count--;
		if (count > 0) return promise;
		const releasedResource = obtainable;
		obtainable = undefined; // reset before releasing just in case release re-obtains
		release(releasedResource!);
		resolve();
		return promise;
	};
	return () => {
		count++;
		if (obtainable === undefined) {
			obtainable = obtain();
			promise = new Promise<void>(r => (resolve = r));
			if (obtainable === undefined) {
				// this prevents `obtain` from being called multiple times,
				// which would cause bugs if it has side effects
				throw Error('Obtainable value cannot be undefined - use null instead.');
			}
		}
		return [obtainable, releaseObtainable];
	};
};
