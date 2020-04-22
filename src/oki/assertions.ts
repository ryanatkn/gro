import {deepEqual} from '../utils/deepEqual.js';
import {ErrorClass} from '../utils/error.js';

export const ok: (value: any) => asserts value = value => {
	if (!value) {
		throw new AssertionError({operator: AssertionOperator.ok, value});
	}
};

export const is = (actual: any, expected: any): void => {
	if (!Object.is(actual, expected)) {
		throw new AssertionError({
			operator: AssertionOperator.is,
			actual,
			expected,
		});
	}
};

export const isNot = (actual: any, expected: any): void => {
	if (Object.is(actual, expected)) {
		throw new AssertionError({
			operator: AssertionOperator.isNot,
			actual,
			expected,
		});
	}
};

export const equal = (actual: any, expected: any): void => {
	if (!deepEqual(actual, expected)) {
		throw new AssertionError({
			operator: AssertionOperator.equal,
			actual,
			expected,
		});
	}
};

export const notEqual = (actual: any, expected: any): void => {
	if (deepEqual(actual, expected)) {
		throw new AssertionError({
			operator: AssertionOperator.notEqual,
			actual,
			expected,
		});
	}
};

export const throws = (
	cb: () => void,
	matcher?: ErrorClass | RegExp | string,
): void => {
	try {
		cb();
	} catch (err) {
		if (!(err instanceof Error)) {
			throw new Error(`Bad!! Non-error value thrown: ${JSON.stringify(err)}`);
		}
		if (!matchError(matcher, err)) {
			throw new AssertionError({
				operator: AssertionOperator.throws,
				matcher,
				thrown: err,
			});
		}
		return;
	}
	throw new AssertionError({
		operator: AssertionOperator.throws,
		matcher,
		thrown: null,
	});
};

export const matchError = (
	matcher: ErrorClass | RegExp | string | undefined,
	error: Error,
): boolean => {
	if (typeof matcher === 'string') {
		return error.message.includes(matcher);
	} else if (matcher instanceof RegExp) {
		return matcher.test(error.message);
	} else if (matcher) {
		return error instanceof matcher;
	}
	// TODO add elided type assertion? `typeis<undefined>(matcher)`
	return true;
};

export class AssertionError extends Error {
	constructor(public readonly assertion: FailedAssertion) {
		super(`Assertion failed: ${assertion.operator}`);
	}
}

/*

If TypeScript's ever supports saying "this will throw",
like with `asserts` but guaranteed failure,
we could replace this with `t.fail`.

*/
export class TestFailureError extends AssertionError {
	constructor(message: string) {
		super({operator: AssertionOperator.fail, message});
	}
}

/*

These need to be explicitly typed because of
TypeScript's `asserts` constraints.
See this error:
	`Assertions require every name in the call target to be declared
	with an explicit type annotation.ts(2775)`

*/
export const t: {
	ok: typeof ok;
	is: typeof is;
	isNot: typeof isNot;
	equal: typeof equal;
	notEqual: typeof notEqual;
	throws: typeof throws;
	Error: typeof TestFailureError;
} = {
	ok,
	is,
	isNot,
	equal,
	notEqual,
	throws,
	Error: TestFailureError,
};

export type Assertions = typeof t;

export enum AssertionOperator {
	ok = 'ok', // truthy
	is = 'is', // Object.is
	isNot = 'isNot', // !Object.is
	equal = 'equal', // deeply equal
	notEqual = 'notEqual', // !deeply equal
	throws = 'throws', // expects `cb` to throw an error that matches optional `matcher`
	fail = 'fail', // throws an error
}

export type FailedAssertion =
	| FailedAssertionOk
	| FailedAssertionIs
	| FailedAssertionIsNot
	| FailedAssertionEqual
	| FailedAssertionNotEqual
	| FailedAssertionFail
	| FailedAssertionThrows;
export type FailedAssertionOk = {
	operator: AssertionOperator.ok;
	value: any;
};
export type FailedAssertionIs = {
	operator: AssertionOperator.is;
	expected: any;
	actual: any;
};
export type FailedAssertionIsNot = {
	operator: AssertionOperator.isNot;
	expected: any;
	actual: any;
};
export type FailedAssertionEqual = {
	operator: AssertionOperator.equal;
	expected: any;
	actual: any;
};
export type FailedAssertionNotEqual = {
	operator: AssertionOperator.notEqual;
	expected: any;
	actual: any;
};
export type FailedAssertionThrows = {
	operator: AssertionOperator.throws;
	matcher: ErrorClass | RegExp | string | undefined;
	thrown: Error | null;
};
export type FailedAssertionFail = {
	operator: AssertionOperator.fail;
	message: string;
};
