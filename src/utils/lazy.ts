export interface Lazy<T> {
	(): T;
}

export const lazy = <T>(value: T | Lazy<T>): T =>
	typeof value === 'function' ? (value as Function)() : value; // TODO fix type casting
