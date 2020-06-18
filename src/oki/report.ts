import {green, red, bgGreen, black, yellow, gray, cyan} from 'kleur/colors';

import {TestContext, TOTAL_TIMING, TestInstance} from './TestContext.js';
import {printMs, printValue, printStr, printError} from '../utils/print.js';
import {toSourcePath} from '../paths.js';
import {AssertionError, AssertionOperator, FailedAssertion} from './assertions.js';
import {UnreachableError, ErrorClass} from '../utils/error.js';

export const reportIntro = (ctx: TestContext): void => {
	ctx.log.newline();
	ctx.log.info('oki..?');
};

export const reportResult = (ctx: TestContext, testInstance: TestInstance): void => {
	const {log, reportBaseIndent, reportListIndent} = ctx;
	const result = testInstance.result!;
	if (result.ok) {
		log.plain(
			reportBaseIndent + reportListIndent.repeat(testInstance.depth),
			green('✓'),
			testInstance.message,
		);
	} else {
		if (result.error instanceof AssertionError) {
			reportAssertionError(ctx, result.error, testInstance);
		} else {
			log.plain(
				reportBaseIndent + reportListIndent.repeat(testInstance.depth),
				red('🞩'),
				testInstance.message,
				'\n',
				red('Uncaught runtime error:'),
				yellow(result.error.stack || result.error.message),
			);
		}
	}
};

export const reportSummary = (ctx: TestContext): void => {
	const {log, stats} = ctx;
	if (!stats) return;
	const {passCount, failCount} = stats;
	ctx.log.newline();
	if (!passCount && !failCount) {
		log.info(
			yellow(
				`No tests were found!` +
					` Is testContext.importModule being called?` +
					` Maybe check the file filter?`,
			),
		);
	} else {
		log.info(green(`${passCount} test${passCount === 1 ? '' : 's'} passed`));
		if (failCount) {
			log.info(red(`${failCount} test${failCount === 1 ? '' : 's'} failed`));
		}
		log.info(gray('🕒'), printMs(ctx.timings.get(TOTAL_TIMING), 1));
		if (failCount) {
			log.info(gray('not oki :|'));
		} else {
			log.info(bgGreen(black(' oki :) ')));
		}
	}
	ctx.log.newline();
};

export const reportFileBegin = (ctx: TestContext, fileId: string): void => {
	ctx.log.newline();
	ctx.log.plain('📁', toSourcePath(fileId));
};
export const reportFileEnd = (ctx: TestContext, fileId: string): void => {
	ctx.log.plain(ctx.reportBaseIndent, gray('🕒'), printMs(ctx.timings.get(fileId), 1));
	// TODO log fail count?
};

export const reportAssertionError = (
	ctx: TestContext,
	error: AssertionError,
	testInstance: TestInstance,
): void => {
	const {log, reportBaseIndent, reportListIndent, reportFullStackTraces} = ctx;
	const {assertion} = error;

	log.plain(
		reportBaseIndent + reportListIndent.repeat(testInstance.depth),
		red('🞩'),
		testInstance.message,
		'\n',
		printFailedAssertion(assertion),
	);

	switch (assertion.operator) {
		case AssertionOperator.ok:
			log.plain(printValue(assertion.value));
			break;
		case AssertionOperator.is:
			log.plain(printValue(assertion.actual));
			log.plain(printValue(assertion.expected));
			break;
		case AssertionOperator.isNot:
			log.plain(printValue(assertion.expected));
			break;
		case AssertionOperator.equal:
			log.plain(printValue(assertion.actual));
			log.plain(printValue(assertion.expected));
			break;
		case AssertionOperator.notEqual:
			log.plain(printValue(assertion.expected));
			break;
		case AssertionOperator.throws:
		case AssertionOperator.rejects:
			const logArgs: any[] = [];
			if (assertion.error) {
				if (assertion.matcher) {
					logArgs.push(printUnmatchedErrorMessage(assertion.matcher, assertion.error));
				}
				logArgs.push('\n' + printThrownError(assertion.error, reportFullStackTraces));
			}
			log.plain(...logArgs);
			break;
		case AssertionOperator.fail:
			log.plain(printError(error));
			break;
		default:
			throw new UnreachableError(assertion);
	}
	log.plain(printAssertionError(error, assertion, reportFullStackTraces), '\n');
};

const printFailedAssertion = (assertion: FailedAssertion): string => {
	switch (assertion.operator) {
		case AssertionOperator.fail: {
			return red('fail asserted in test:');
		}
		default: {
			return red('!' + assertion.operator);
		}
	}
};

const printAssertionError = (
	error: Error,
	assertion: FailedAssertion,
	reportFullStackTraces: boolean,
): string => {
	const {stack} = error;
	if (stack) {
		if (reportFullStackTraces) return gray(stack);
		if (error instanceof AssertionError) {
			// Discard the lines from library code.
			// This is error-prone but much nicer to work with.
			let parts = stack.split('\n').slice(2);
			parts = parts.slice(0, parts.findIndex(shouldIgnoreAssertionErrorLine));
			return gray(`AssertionError: !${assertion.operator}\n` + parts.join('\n'));
		} else {
			return gray(stack);
		}
	} else {
		return error.message;
	}
};

// TODO this is very brittle
const IGNORED_ERROR_LINE_PARTIAL = TestContext.name + '.';
const shouldIgnoreAssertionErrorLine = (s: string) => s.includes(IGNORED_ERROR_LINE_PARTIAL);

const printThrownError = (error: Error, reportFullStackTraces: boolean): string => {
	const {stack} = error;
	if (stack) {
		if (reportFullStackTraces) return gray(stack);
		// Discard the lines from library code.
		// This is error-prone but much nicer to work with.
		let parts = stack.split('\n');
		parts = parts.slice(0, parts.findIndex(shouldIgnoreThrownErrorLine));
		return gray(parts.join('\n'));
	} else {
		return red(error.message);
	}
};

// TODO this is very brittle
const MATCH_IGNORED_ERROR_LINE = /at exports.throws .+oki\/assertions\..+/;
const shouldIgnoreThrownErrorLine = (s: string) => MATCH_IGNORED_ERROR_LINE.test(s);

const printUnmatchedErrorMessage = (
	matcher: string | RegExp | ErrorClass,
	error: Error,
): string => {
	const strs: string[] = [];
	if (typeof matcher === 'string') {
		strs.push(
			printMatcher(matcher),
			'is not a substring of error message',
			printStr(error.message),
		);
	} else if (matcher instanceof RegExp) {
		strs.push(printMatcher(matcher), 'does not match error message', printStr(error.message));
	} else {
		strs.push(printMatcher(matcher), 'is not a superclass of error', cyan(error.name));
	}
	return strs.join(' ');
};

const printMatcher = (matcher: string | RegExp | ErrorClass): string => {
	if (typeof matcher === 'string') {
		return printStr(matcher);
	} else if (matcher instanceof RegExp) {
		return green(matcher.toString()); // default is red, but that's reserved for errors
	} else {
		return cyan(matcher.name);
	}
};
