/*

This is a higher order function that tracks obtained references to a thing
and calls `release` when all obtainers have released their references.

It allows decoupled consumers to use things with a lifecycle
without disrupting each other when they're done with the thing.

The motivating use case was reusing a database connection across multiple tasks.

See the tests for usage examples - ./createObtainable.test.ts

*/
export const createObtainable = <T>(
	createObtainableValue: () => T,
	teardownObtainableValue?: (obtainable: T) => void,
): (() => [T, () => Promise<void>]) => {
	let obtainable: T | undefined;
	const obtainedRefs = new Set<symbol>();
	let resolve: () => void;
	let promise: Promise<void>;
	const releaseObtainable = (obtainedRef: symbol): Promise<void> => {
		if (!obtainedRefs.has(obtainedRef)) return promise; // makes releasing idempotent per obtainer
		obtainedRefs.delete(obtainedRef);
		if (obtainedRefs.size > 0) return promise; // there are other open obtainers
		const releasedResource = obtainable;
		obtainable = undefined; // reset before releasing just in case release re-obtains
		if (teardownObtainableValue) teardownObtainableValue(releasedResource!);
		resolve();
		return promise;
	};
	return () => {
		const obtainedRef = Symbol();
		obtainedRefs.add(obtainedRef);
		if (obtainable === undefined) {
			obtainable = createObtainableValue();
			promise = new Promise<void>(r => (resolve = r));
			if (obtainable === undefined) {
				// this prevents `obtain` from being called multiple times,
				// which would cause bugs if it has side effects
				throw Error('Obtainable value cannot be undefined - use null instead.');
			}
		}
		return [obtainable, () => releaseObtainable(obtainedRef)];
	};
};
