// Cache a global map so we get the same instance
// regardless of any duplicate module imports.
// This was motivated by the global test registration
// process that broke when `gro` self-tested,
// using the `dist` directory for the test runner context
// and `build` directory for the imported tests.
declare module globalThis {
	export let gro: Map<any, any>;
}
export const gro = globalThis.gro || (globalThis.gro = new Map());

export interface GlobalRef<T> {
	exists(): boolean;
	get(): T;
	set(v: T): void;
	delete(v: T): void; // require the value to avoid mistakes - ideally the code sends a local reference instead `ref.delete(ref.get())`
}

export const createGlobalRef = <T>(key: any): GlobalRef<T> => {
	const ref: GlobalRef<T> = {
		exists: () => gro.has(key),
		get: () => {
			if (!ref.exists()) {
				throw Error(
					`Cannot get global ref key '${key}' because it does not exist`,
				);
			}
			return gro.get(key);
		},
		set: value => {
			if (ref.exists()) {
				throw Error(
					`Cannot set global ref key '${key}' because it already has a value: ${ref.get()}`,
				);
			}
			gro.set(key, value);
		},
		delete: value => {
			if (!ref.exists()) {
				throw Error(
					`Cannot delete global ref key '${key}' because it does not exist`,
				);
			}
			if (!Object.is(value, ref.get())) {
				throw Error(
					`Cannot delete global ref key '${key}' because values do not match: ${value} !== ${ref.get()}`,
				);
			}
			gro.delete(key);
		},
	};
	return ref;
};
