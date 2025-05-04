const local_variable = 'test';
function local_fn(): boolean {
	return true;
}
type local_type = string;
class local_class {
	a = 1;
}

// Named exports using export specifiers
export {local_variable as exported_variable};
export {local_fn as exported_fn};
export type {local_type as exported_type};
export {local_class as exported_class};

// Default export
export default local_variable;
