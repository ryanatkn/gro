// This file contains systematic examples of all different kinds of exports
// for testing the src_json module

// Type declarations
type Simple_Type = string;
interface Simple_Interface {
	prop: string;
}

// Variable declarations with different kinds of values
const simple_variable = 'test string';
const extra_variable = 'extra value'; // Added for mixed exports to avoid duplication
const arrow_function = (): string => 'arrow function result';
const multi_line_arrow = (): string => {
	return 'multi-line arrow result';
};
const object_value = {key: 'value'};
const numeric_value = 123;
function declared_function(): string {
	return 'declared function result';
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Simple_Class {}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
const class_expression = class Named_Class {};

// Direct exports
export const direct_variable = 'direct variable';
export const direct_arrow_function = (): string => 'direct arrow function';
export function direct_function(): string {
	return 'direct function';
}
export type Direct_Type = boolean;
export interface Direct_Interface {
	value: boolean;
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Direct_Class {}

// Named exports
export {simple_variable};
export {arrow_function, multi_line_arrow};
export {declared_function};
export {Simple_Class};
export {class_expression};
export {object_value, numeric_value};

// Renamed exports
export {simple_variable as renamed_variable};
export {arrow_function as renamed_function};
export {Simple_Class as Renamed_Class};
export type {Simple_Type as Renamed_Type};

// Type exports
export type {Simple_Type};
export type {Simple_Interface};
export type {simple_variable as Variable_Type};

// Mixed exports with type specifier - using extra_variable to avoid duplicate
export {extra_variable, type Simple_Type as Explicit_Type};

// Default export
export default arrow_function;

// Dual exports (as both type and value)
const dual_purpose = 'I am both value and type';
type dual_purpose = string;
export {dual_purpose};
export type {dual_purpose as dual_purpose_type};
