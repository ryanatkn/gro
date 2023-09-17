import {wait} from '@feltjs/util/async.js';

// TODO maybe support return values? gets tricky: what should it return for the skipped ones?

/**
 * Throttles calls to a promise-returning function.
 * Immediately invokes the throttled `fn` on the first call.
 * If it's called while the promise is already pending,
 * a call is queued up to run after the promise completes,
 * and only the last call is invoked.
 * In other words, calls except the most recent made during the pending promise are discarded.
 * This is distinct from a queue where every call to the throttled function eventually runs.
 * Unlike most debouncing, this calls the throttled function
 * both on the leading and trailing edges of the delay window.
 * The `to_cache_key` helper can be called to conveniently batch similar calls by an arbitrary key.
 * @param fn - any promise-returning function
 * @param delay - delay this many milliseconds after the previous call finishes
 * @param to_cache_key - grouped on this `Map` key returned from this function
 * @returns return value of of `fn`.
 */
export const throttle = <TArgs extends any[]>(
	fn: (...args: TArgs) => Promise<void>,
	delay = 0,
	to_cache_key?: (...args: TArgs) => any,
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
