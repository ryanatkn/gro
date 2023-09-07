import {wait} from '@feltjs/util/async.js';

// TODO maybe support return values? gets tricky: what should it return for the skipped ones?

/**
 * Throttles calls to a promise-returning function.
 * If the throttled function is called while the promise is pending,
 * it's queued up to run after the promise completes,
 * and only the last call is executed.
 * Calls except the most recent made during the pending promise are discarded.
 * This is distinct from a queue where every call to the throttled function eventually runs.
 * @param fn Any promise-returning function.
 * @param to_cache_key Throttled calls are grouped by the `Map` key returned from this function.
 * @param delay Throttled calls delay this many milliseconds after the previous call finishes.
 * @returns Same as `fn`.
 */
export const throttle = <TArgs extends any[]>(
	fn: (...args: TArgs) => Promise<void>,
	to_cache_key?: (...args: TArgs) => any,
	delay = 0,
): ((...args: TArgs) => Promise<void>) => {
	const cache: Map<string, {id: number; promise: Promise<void>}> = new Map();
	let _id = 0;
	return async (...args) => {
		const id = _id++;
		const cache_key = to_cache_key ? to_cache_key(...args) : null;
		let cached = cache.get(cache_key);
		if (cached) {
			cached.id = id; // queue this one up
			await cached.promise;
			if (cached.id !== id) return; // a later call supercedes this one
		}
		const result = fn(...args);
		const promise = result.then(async () => {
			if (delay) await wait(delay);
			if (id === cached!.id) {
				cache.delete(cache_key); // delete only when we're done with this `cache_key`
			}
		});
		if (!cached) {
			cached = {promise, id};
			cache.set(cache_key, cached);
		}
		return result;
	};
};
