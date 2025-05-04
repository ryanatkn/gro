// Different function declaration patterns
export function declared_function(a: number): string {
	return a.toString();
}

export const arrow_function = (a: number): string => a.toString();

export const multiline_arrow = () => {
	return 'multiline';
};

// Function with overloads
export function overloaded_function(a: string): string;
export function overloaded_function(a: number): number;
export function overloaded_function(a: any): any {
	return a;
}

// Async function
export async function async_function() {
	return Promise.resolve('async');
}

export const async_arrow = async (): Promise<string> => 'async arrow';

// Default export function
export default function default_function() {
	return 'default';
}
