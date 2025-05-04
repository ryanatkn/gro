// Various declaration types
type Type1 = string;
interface Interface1 {
	prop: string;
}
const variable1 = 'test';
const fn1 = (): boolean => true;
function fn2(): boolean {
	return false;
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Class1 {}

// Re-export with same name
export {variable1};
export type {Type1};

// Re-export with different name
export {variable1 as renamed_variable};
export type {Type1 as renamed_type};

// Direct exports
export const direct_variable = 123;
export const direct_function = (): string => 'hello';
export function direct_named_function(): string {
	return 'world';
}
export type DirectType = boolean;
export interface DirectInterface {
	name: string;
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DirectClass {}

// Export default
export default fn1;

// Export multiple at once with different kinds
export {fn2, Class1, type Interface1};
