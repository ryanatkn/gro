import {deepEqual} from '../utils/deepEqual.js';
import {ErrorClass} from '../utils/errorUtils.js';

// TODO typescript 3.7 `asserts` ?

export const ok = (value: any): AssertionOk => {
	return value
		? {ok: true, operator: AssertionOperator.ok, value}
		: {ok: false, operator: AssertionOperator.ok, value};
};

export const notOk = (value: any): AssertionNotOk => {
	return value
		? {ok: false, operator: AssertionOperator.notOk, value}
		: {ok: true, operator: AssertionOperator.notOk, value};
};

export const is = (actual: any, expected: any): AssertionIs => {
	return Object.is(actual, expected)
		? {ok: true, operator: AssertionOperator.is, actual, expected}
		: {ok: false, operator: AssertionOperator.is, actual, expected};
};

export const isNot = (actual: any, expected: any): AssertionIsNot => {
	return Object.is(actual, expected)
		? {ok: false, operator: AssertionOperator.isNot, actual, expected}
		: {ok: true, operator: AssertionOperator.isNot, actual, expected};
};

export const equal = (actual: any, expected: any): AssertionEqual => {
	return deepEqual(actual, expected)
		? {ok: true, operator: AssertionOperator.equal, actual, expected}
		: {ok: false, operator: AssertionOperator.equal, actual, expected};
};

export const notEqual = (actual: any, expected: any): AssertionNotEqual => {
	return deepEqual(actual, expected)
		? {ok: false, operator: AssertionOperator.notEqual, actual, expected}
		: {ok: true, operator: AssertionOperator.notEqual, actual, expected};
};

export const fail = (message: string): FailedAssertionFail => {
	return {ok: false, operator: AssertionOperator.fail, message};
};

export const throws = (
	cb: () => void,
	matcher?: ErrorClass | RegExp | string,
): AssertionThrows => {
	try {
		cb();
	} catch (err) {
		if (!(err instanceof Error)) {
			throw new Error(`Bad!! Non-error value thrown: ${JSON.stringify(err)}`);
		}
		if (!matchError(matcher, err)) {
			return {
				ok: false,
				operator: AssertionOperator.throws,
				matcher,
				thrown: err,
			};
		}
		return {
			ok: true,
			operator: AssertionOperator.throws,
			matcher,
			thrown: err,
		};
	}
	return {
		ok: false,
		operator: AssertionOperator.throws,
		matcher,
		thrown: null,
	};
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

export const assertions = {
	ok,
	notOk,
	is,
	isNot,
	equal,
	notEqual,
	fail,
	throws,
};

export type Assertions = typeof assertions;

export type AssertionsThatThrow = {
	[P in keyof Assertions]: (...args: Parameters<Assertions[P]>) => void;
};

export class AssertionError extends Error {
	constructor(public readonly assertion: FailedAssertion) {
		super(`Assertion failed: ${assertion.operator}`);
	}
}

export const wrapAssertionToThrow = <T extends any[]>(
	assertion: (...args: T) => Assertion,
) => (...args: T): void => {
	const result = assertion(...args);
	if (!result.ok) {
		throw new AssertionError(result);
	}
};

export const wrapAssertionsToThrow = (a: Assertions): AssertionsThatThrow => {
	const result: any = {};
	for (const key in a) {
		result[key] = wrapAssertionToThrow((a as any)[key]); // TODO type instead of casting?
	}
	return result;
};
export const assertionsThatThrow = wrapAssertionsToThrow(assertions);

export type Assertion = PassedAssertion | FailedAssertion;

export enum AssertionOperator {
	ok = 'ok', // truthy
	notOk = 'notOk', // falsy
	is = 'is', // Object.is
	isNot = 'isNot', // !Object.is
	equal = 'equal', // deeply equal
	notEqual = 'notEqual', // !deeply equal
	fail = 'fail', // throws an error
	throws = 'throws', // expects `cb` to throw an error that matches optional `matcher`
}

export type AssertionOk = PassedAssertionOk | FailedAssertionOk;
export type AssertionNotOk = PassedAssertionNotOk | FailedAssertionNotOk;
export type AssertionIs = PassedAssertionIs | FailedAssertionIs;
export type AssertionIsNot = PassedAssertionIsNot | FailedAssertionIsNot;
export type AssertionEqual = PassedAssertionEqual | FailedAssertionEqual;
export type AssertionThrows = PassedAssertionThrows | FailedAssertionThrows;
export type AssertionNotEqual =
	| PassedAssertionNotEqual
	| FailedAssertionNotEqual;

export type PassedAssertion =
	| PassedAssertionOk
	| PassedAssertionNotOk
	| PassedAssertionIs
	| PassedAssertionIsNot
	| PassedAssertionEqual
	| PassedAssertionNotEqual
	| PassedAssertionThrows;
export type PassedAssertionThrows = {
	ok: true;
	operator: AssertionOperator.throws;
	matcher: ErrorClass | RegExp | string | undefined;
	thrown: Error;
};
export type PassedAssertionOk = {
	ok: true;
	operator: AssertionOperator.ok;
	value: any;
};
export type PassedAssertionNotOk = {
	ok: true;
	operator: AssertionOperator.notOk;
	value: any;
};
export type PassedAssertionIs = {
	ok: true;
	operator: AssertionOperator.is;
	expected: any;
	actual: any;
};
export type PassedAssertionIsNot = {
	ok: true;
	operator: AssertionOperator.isNot;
	expected: any;
	actual: any;
};
export type PassedAssertionEqual = {
	ok: true;
	operator: AssertionOperator.equal;
	expected: any;
	actual: any;
};
export type PassedAssertionNotEqual = {
	ok: true;
	operator: AssertionOperator.notEqual;
	expected: any;
	actual: any;
};

export type FailedAssertion =
	| FailedAssertionOk
	| FailedAssertionNotOk
	| FailedAssertionIs
	| FailedAssertionIsNot
	| FailedAssertionEqual
	| FailedAssertionNotEqual
	| FailedAssertionFail
	| FailedAssertionThrows;
export type FailedAssertionOk = {
	ok: false;
	operator: AssertionOperator.ok;
	value: any;
};
export type FailedAssertionNotOk = {
	ok: false;
	operator: AssertionOperator.notOk;
	value: any;
};
export type FailedAssertionIs = {
	ok: false;
	operator: AssertionOperator.is;
	expected: any;
	actual: any;
};
export type FailedAssertionIsNot = {
	ok: false;
	operator: AssertionOperator.isNot;
	expected: any;
	actual: any;
};
export type FailedAssertionEqual = {
	ok: false;
	operator: AssertionOperator.equal;
	expected: any;
	actual: any;
};
export type FailedAssertionNotEqual = {
	ok: false;
	operator: AssertionOperator.notEqual;
	expected: any;
	actual: any;
};
export type FailedAssertionFail = {
	ok: false;
	operator: AssertionOperator.fail;
	message: string;
};
export type FailedAssertionThrows = {
	ok: false;
	operator: AssertionOperator.throws;
	matcher: ErrorClass | RegExp | string | undefined;
	thrown: Error | null;
};
