// Basic class
export class Basic_Class {
	property = 'value';
	method() {
		return this.property;
	}
}

// Class with constructor
export class With_Constructor {
	property: string;

	constructor(value: string) {
		this.property = value;
	}
}

// Class expression
export const Class_Expression = class {
	value = 42;
};

// Abstract class
export abstract class Abstract_Class {
	abstract abstract_method(): void;

	concrete_method() {
		return 'concrete';
	}
}

// Default export class
export default class Default_Class {
	default_property = 'default';
}
