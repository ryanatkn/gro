export type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';

export const wait = (duration = 0) => new Promise((resolve) => setTimeout(resolve, duration));

interface WrapAfter {
	(cb: WrapAfterCallback): void;
}
interface WrapAfterCallback {
	(): unknown | Promise<unknown>;
}
export const wrap = <T>(fn: (after: WrapAfter) => Promise<T>): Promise<T> => {
	let cbs: WrapAfterCallback[] | null = null;
	const after: WrapAfter = (cb) => {
		(cbs || (cbs = [])).push(cb);
	};
	const callCbs = async () => {
		if (cbs === null) return;
		for (const cb of cbs) {
			await cb();
		}
	};
	return fn(after).then(
		async (value) => {
			await callCbs();
			return value;
		},
		async (err) => {
			await callCbs();
			throw err;
		},
	);
};
