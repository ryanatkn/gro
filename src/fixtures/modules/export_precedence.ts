// Variables that will be exported as both type and value
const Dual_Export = 'I am both a variable and a type';
const Function_And_Type = (): string => 'hello';

// Type definitions with the same names
type Dual_Export = string;
type Function_And_Type = () => string;

// Another variable that will only be exported as a type
const Another_Dual_Export = 123;
type Another_Dual_Export = {
	prop: number;
};

// Export values
export {Dual_Export};

// Export types
export type {Function_And_Type};

// Only export as type
export type {Another_Dual_Export};

// Additional test cases
const Value_Only = true;
type Type_Only = boolean;

// Value-only export
export {Value_Only};

// Type-only export
export type {Type_Only};
