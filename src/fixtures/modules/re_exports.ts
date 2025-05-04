// Local values for type exports
const local_value = 'value';
type Local_Type = number;
function local_function() {
	return true;
}

// Basic exports that are simple
export const basic_variable = 'value';
export function basic_function() {
	return 'function value';
}

// Basic type exports
export type Basic_Type = string;
export interface Basic_Interface {
	prop: string;
}

// Re-export from function_exports module
export {declared_function, arrow_function} from './function_exports.js';
export type {declared_function as TypedFunction} from './function_exports.js';

// Re-export with renaming
export {declared_function as renamed_function} from './function_exports.js';

// Re-export default from function_exports
export {default as renamed_default} from './function_exports.js';

// Export local value and function
export {local_value, local_function as exported_function};

// Export local value as type
export type {local_value as Value_As_Type};
export type {Local_Type as Type_Name};

// Re-export our own exports
export {basic_variable as re_exported_variable} from './re_exports.js';
export type {Basic_Type as Renamed_Type} from './re_exports.js';
export {type Basic_Type as Another_Renamed_Type} from './re_exports.js';
