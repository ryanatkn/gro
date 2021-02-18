import {deepEqual} from '../utils/deepEqual.js';
import {ErrorClass} from '../utils/error.js';

export type AssertionOperator =
	| 'ok' // truthy
	| 'is' // Object.is
	| 'isNot' // !Object.is
	| 'equal' // deeply equal
	| 'notEqual' // !deeply equal
	| 'throws' // expects `cb` to throw an error that matches optional `matcher`
	| 'rejects' // expects `cbOrPromise` to throw an error that matches optional `matcher`
	| 'fail'; // throws an error

export class AssertionError extends Error {
	constructor(public readonly assertion: FailedAssertion, message?: string) {
		super(message || `Assertion failed: ${assertion.operator}`);
	}
}

export const ok: (value: any) => asserts value = (value) => {
	if (!value) {
		throw new AssertionError({operator: 'ok', value});
	}
};

export const is = <T>(actual: T, expected: T): void => {
	if (!Object.is(actual, expected)) {
		throw new AssertionError({operator: 'is', actual, expected});
	}
};

export const isNot = (actual: any, expected: any): void => {
	if (Object.is(actual, expected)) {
		throw new AssertionError({operator: 'isNot', actual, expected});
	}
};

export const equal = <T>(actual: T, expected: T): void => {
	if (!deepEqual(actual, expected)) {
		throw new AssertionError({operator: 'equal', actual, expected});
	}
};

export const notEqual = (actual: any, expected: any): void => {
	if (deepEqual(actual, expected)) {
		throw new AssertionError({operator: 'notEqual', actual, expected});
	}
};

export const throws = (cb: () => void, matcher?: ErrorClass | RegExp | string): void => {
	try {
		cb();
	} catch (error) {
		if (matcher !== undefined && !matchError(matcher, error)) {
			throw new AssertionError({operator: 'throws', matcher, error});
		}
		return;
	}
	throw new AssertionError({operator: 'throws', matcher, error: null});
};

export const rejects = async (
	cbOrPromise: Promise<any> | (() => Promise<void>),
	matcher?: ErrorClass | RegExp | string,
): Promise<void> => {
	try {
		const promise = typeof cbOrPromise === 'function' ? cbOrPromise() : cbOrPromise;
		await promise;
	} catch (error) {
		if (matcher !== undefined && !matchError(matcher, error)) {
			throw new AssertionError({operator: 'rejects', matcher, error});
		}
		return;
	}
	throw new AssertionError({operator: 'rejects', matcher, error: null});
};

export const matchError = (matcher: ErrorClass | RegExp | string, error: Error): boolean => {
	if (typeof matcher === 'string') {
		return error.message.includes(matcher);
	} else if (matcher instanceof RegExp) {
		return matcher.test(error.message);
	}
	return error instanceof matcher;
};

export const fail = (message: string): never => {
	throw new TestFailureError(message);
};

export class TestFailureError extends AssertionError {
	constructor(message: string) {
		super({operator: 'fail', message}, message);
	}
}

/*

These need to be explicitly typed because of
TypeScript's `asserts` constraints.
See this error:
	`Assertions require every name in the call target to be declared
	with an explicit type annotation.ts(2775)`

*/
export type Assertions = {
	ok: typeof ok;
	is: typeof is;
	isNot: typeof isNot;
	equal: typeof equal;
	notEqual: typeof notEqual;
	throws: typeof throws;
	rejects: typeof rejects;
	fail: typeof fail;
	Error: typeof TestFailureError;
};
export const t: Assertions = {
	ok,
	is,
	isNot,
	equal,
	notEqual,
	throws,
	rejects,
	fail,
	Error: TestFailureError,
};

export type FailedAssertion =
	| FailedAssertionOk
	| FailedAssertionIs
	| FailedAssertionIsNot
	| FailedAssertionEqual
	| FailedAssertionNotEqual
	| FailedAssertionThrows
	| FailedAssertionRejects
	| FailedAssertionFail;
export type FailedAssertionOk = {
	operator: 'ok';
	value: any;
};
export type FailedAssertionIs = {
	operator: 'is';
	expected: any;
	actual: any;
};
export type FailedAssertionIsNot = {
	operator: 'isNot';
	expected: any;
	actual: any;
};
export type FailedAssertionEqual = {
	operator: 'equal';
	expected: any;
	actual: any;
};
export type FailedAssertionNotEqual = {
	operator: 'notEqual';
	expected: any;
	actual: any;
};
export type FailedAssertionThrows = {
	operator: 'throws';
	matcher: ErrorClass | RegExp | string | undefined;
	error: Error | null;
};
export type FailedAssertionRejects = {
	operator: 'rejects';
	matcher: ErrorClass | RegExp | string | undefined;
	error: Error | null;
};
export type FailedAssertionFail = {
	operator: 'fail';
	message: string;
};
