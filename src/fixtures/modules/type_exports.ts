// Type declarations
type Type_Example = string;
interface Interface_Example {
	prop: string;
}

// Actual variables with the same names
const Variable_Example = 'test';
const Another_Variable = 123;

// Export both as variable and type
export {Variable_Example, Another_Variable};
export type {Type_Example, Interface_Example};

// Export variable as type
export type {Variable_Example as Variable_Type};

// Named type and variable exports
export type Named_Type_Export = boolean;
export const Named_Variable_Export = true;
