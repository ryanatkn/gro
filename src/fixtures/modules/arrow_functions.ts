// Arrow functions should be identified as functions
export const arrow_fn1 = (): boolean => {
	return true;
};
export const arrow_fn2 = (x: number): number => x * 2;

// Variables that are not functions
export const regular_variable = 'not a function';

// Function declaration
export function declared_fn(): boolean {
	return false;
}
