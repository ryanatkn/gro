import {wait} from '@ryanatkn/belt/async.js';

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
let i = 0;
export const throttle = <T extends (...args: any[]) => Promise<void>>(
	cb: T,
	delay = 0,
	leading = true,
): T => {
	const id = i++;
	let pending_promise: Promise<void> | null = null;
	let next_args: any[] | null = null;
	let next_promise: Promise<void> | null = null;
	let next_promise_resolve: ((value: any) => void) | null = null;

	const defer = (args: any[]): Promise<void> => {
		console.log(id, '[defer]');
		next_args = args;
		if (!next_promise) {
			console.log(id, '[defer] creating promise');
			next_promise = new Promise((resolve) => {
				next_promise_resolve = resolve;
			});
		}
		return next_promise;
	};

	const flush = async (): Promise<void> => {
		console.log(id, '[flush]');
		if (!next_promise_resolve) return;
		console.log(id, '[flush] calling');
		const result = await call(next_args!);
		console.log(id, '[flush] called');
		next_args = null;
		next_promise = null;
		const resolve = next_promise_resolve;
		next_promise_resolve = null;
		console.log(id, '[flush] resolving');
		resolve(result); // resolve last to prevent synchronous call issues
	};

	const call = (args: any[]): Promise<any> => {
		console.log(id, '[call]');
		pending_promise = cb(...args);
		void pending_promise.then(async () => {
			console.log(id, '[call] inside pending');
			await wait(delay);
			console.log(id, '[call] inside pending after wait');
			pending_promise = null;
			await flush();
		});
		return pending_promise;
	};

	return ((...args) => {
		if (pending_promise || !leading) {
			console.log(id, 'cb defer');
			return defer(args);
		} else {
			console.log(id, 'cb call');
			return call(args);
		}
	}) as T;
};
