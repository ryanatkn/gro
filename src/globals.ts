declare module 'mri';

declare module 'kleur/colors' {
	type Colorize = (s: unknown) => string;

	export const $: {
		enabled: boolean;
	};

	// modifiers
	export const reset: Colorize;
	export const bold: Colorize;
	export const dim: Colorize;
	export const italic: Colorize;
	export const underline: Colorize;
	export const inverse: Colorize;
	export const hidden: Colorize;
	export const strikethrough: Colorize;

	// colors
	export const black: Colorize;
	export const red: Colorize;
	export const green: Colorize;
	export const yellow: Colorize;
	export const blue: Colorize;
	export const magenta: Colorize;
	export const cyan: Colorize;
	export const white: Colorize;
	export const gray: Colorize;
	export const grey: Colorize;

	// background colors
	export const bgBlack: Colorize;
	export const bgRed: Colorize;
	export const bgGreen: Colorize;
	export const bgYellow: Colorize;
	export const bgBlue: Colorize;
	export const bgMagenta: Colorize;
	export const bgCyan: Colorize;
	export const bgWhite: Colorize;
}

// TODO https://github.com/lukeed/uvu/pull/105
// experiment with the other types too!
declare module 'uvu/assert' {
	type Types = 'string' | 'number' | 'boolean' | 'object' | 'undefined' | 'function';

	export type Message = string | Error;
	export function ok(actual: any, msg?: Message): asserts actual;
	export function is(actual: any, expects: any, msg?: Message): void;
	export function equal(actual: any, expects: any, msg?: Message): void;
	export function type(actual: any, expects: Types, msg?: Message): void;
	export function instance(actual: any, expects: any, msg?: Message): void;
	export function snapshot(actual: string, expects: string, msg?: Message): void;
	export function fixture(actual: string, expects: string, msg?: Message): void;
	export function match(actual: string, expects: string | RegExp, msg?: Message): void;
	export function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
	export function not(actual: any, msg?: Message): void;
	export function unreachable(msg?: Message): void;

	export namespace is {
		function not(actual: any, expects: any, msg?: Message): void;
	}

	export namespace not {
		function ok(
			actual: any,
			msg?: Message,
		): asserts actual is false | '' | null | undefined | 0 | -0 | typeof NaN;
		function equal(actual: any, expects: any, msg?: Message): void;
		function type(actual: any, expects: Types, msg?: Message): void;
		function instance(actual: any, expects: any, msg?: Message): void;
		function snapshot(actual: string, expects: string, msg?: Message): void;
		function fixture(actual: string, expects: string, msg?: Message): void;
		function match(actual: string, expects: string | RegExp, msg?: Message): void;
		function throws(fn: Function, expects?: Message | RegExp | Function, msg?: Message): void;
	}

	export class Assertion extends Error {
		name: 'Assertion';
		code: 'ERR_ASSERTION';
		details: false | string;
		generated: boolean;
		operator: string;
		expects: any;
		actual: any;
		constructor(options?: {
			message: string;
			details?: string;
			generated?: boolean;
			operator: string;
			expects: any;
			actual: any;
		});
	}
}
