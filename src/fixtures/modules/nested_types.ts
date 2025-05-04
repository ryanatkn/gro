// Simple type
export type Simple_Type = string;

// Generic type
export type Generic_Type<T> = Array<T>;

// Union type
export type Union_Type = string | number;

// Intersection type
export type Intersection_Type = {name: string} & {id: number};

// Mapped type
export type Mapped_Type<T> = {
	[K in keyof T]: T[K];
};

// Conditional type
export type Conditional_Type<T> = T extends string ? 'string' : 'not string';

// Complex nested type
export type Complex_Type = {
	name: string;
	properties: Array<{
		id: number;
		values: Map<string, Union_Type>;
	}>;
	getters: {
		[key: string]: () => any;
	};
};

// Interface with generics
export interface Generic_Interface<T> {
	value: T;
	process(input: T): T;
}

// Interface extending another interface
export interface Base_Interface {
	base: string;
}

export interface Extended_Interface extends Base_Interface {
	extended: number;
}
