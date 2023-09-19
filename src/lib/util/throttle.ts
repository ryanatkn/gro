import {wait} from '@feltjs/util/async.js';

// TODO maybe support non-promise return values?

/**
 * Throttles calls to a callback that returns a void promise.
 * Immediately invokes the callback on the first call.
 * If the throttled function is called while the promise is already pending,
 * the call is queued to run after the pending promise completes plus `delay`,
 * and only the last call is invoked.
 * In other words, all calls and their args are discarded
 * during the pending window except for the most recent.
 * Unlike debouncing, this calls the throttled callback
 * both on the leading and trailing edges of the delay window.
 * It also differs from a queue where every call to the throttled callback eventually runs.
 * @param cb - any function that returns a void promise
 * @param delay - delay this many milliseconds between the pending call finishing and the next starting
 * @returns same as `cb`
 */
export const throttle = <T extends (...args: any[]) => Promise<void>>(cb: T, delay = 0): T => {
	let pending_promise: Promise<void> | null = null;
	let next_args: any[] | null = null;
	let next_promise: Promise<void> | null = null;
	let next_promise_resolve: ((value: any) => void) | null = null;

	const defer = (args: any[]): Promise<void> => {
		next_args = args;
		if (!next_promise) {
			next_promise = new Promise((resolve) => {
				next_promise_resolve = resolve;
			});
		}
		return next_promise;
	};

	const flush = async (): Promise<void> => {
		if (!next_promise_resolve) return;
		const result = await call(next_args!);
		next_args = null;
		next_promise = null;
		const resolve = next_promise_resolve;
		next_promise_resolve = null;
		resolve(result); // resolve last to prevent synchronous call issues
	};

	const call = (args: any[]): Promise<void> => {
		pending_promise = cb(...args);
		void pending_promise.then(async () => {
			await wait(delay);
			pending_promise = null;
			await flush();
		});
		return pending_promise;
	};

	return ((...args) => {
		if (pending_promise) {
			return defer(args);
		} else {
			return call(args);
		}
	}) as T;
};
