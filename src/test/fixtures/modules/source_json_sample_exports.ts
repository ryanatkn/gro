// This file contains systematic examples of all different kinds of exports in `source_json`

// Type declarations
type SimpleType = string;
interface SimpleInterface {
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
class SimpleClass {
	property: string;
	constructor(property: string) {
		this.property = property;
	}
}
const class_expression = class NamedClass {
	property: string;
	constructor(property: string) {
		this.property = property;
	}
};

// Direct exports
export const direct_variable = 'direct variable';
export const direct_arrow_function = (): string => 'direct arrow function';
export function direct_function(): string {
	return 'direct function';
}
export type DirectType = boolean;
export interface DirectInterface {
	value: boolean;
}
export class DirectClass {
	property: string;
	constructor(property: string) {
		this.property = property;
	}
}

// Named exports
export {simple_variable};
export {arrow_function, multi_line_arrow};
export {declared_function};
export {SimpleClass};
export {class_expression};
export {object_value, numeric_value};

// Renamed exports
export {simple_variable as renamed_variable};
export {arrow_function as renamed_function};
export {SimpleClass as RenamedClass};
export type {SimpleType as RenamedType};

// Type exports
export type {SimpleType};
export type {SimpleInterface};
export type {simple_variable as VariableType};

// Mixed exports with type specifier - using extra_variable to avoid duplicate
export {extra_variable, type SimpleType as ExplicitType};

// Default export
export default arrow_function;

// Dual exports (as both type and value)
const dual_purpose = 'I am both value and type';
type dual_purpose = string;
export {dual_purpose};
export type {dual_purpose as dual_purpose_type};
