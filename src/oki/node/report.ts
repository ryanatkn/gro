import {
	green,
	red,
	bgGreen,
	black,
	yellow,
	gray,
	cyan,
} from '../../colors/terminal.js';
import {TestContext, TOTAL_TIMING, TestInstance} from '../TestContext.js';
import {logNewline} from '../../utils/log.js';
import {fmtMs, fmtValue, fmtStr} from '../../utils/fmt.js';
import {toSourcePath} from '../../paths.js';
import {
	AssertionError,
	AssertionOperator,
	FailedAssertion,
} from '../assertions.js';
import {UnreachableError, ErrorClass} from '../../utils/error.js';

export const reportIntro = (ctx: TestContext): void => {
	logNewline();
	ctx.log.info('oki..?');
};

export const reportResult = (
	ctx: TestContext,
	testInstance: TestInstance,
): void => {
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
	const {
		log: {info},
		stats,
	} = ctx;
	if (!stats) {
		throw Error(`Expected test context to have stats to report summary`);
	}
	const {passCount, failCount} = stats;
	logNewline();
	if (!passCount && !failCount) {
		info(yellow(`No tests were found! Maybe check the filter?`));
	} else {
		info(green(`${passCount} test${passCount === 1 ? '' : 's'} passed`));
		if (failCount) {
			info(red(`${failCount} test${failCount === 1 ? '' : 's'} failed`));
		}
		info(gray('🕒'), fmtMs(ctx.timings.get(TOTAL_TIMING), 1));
		if (failCount) {
			info(gray('not oki :|'));
		} else {
			info(bgGreen(black(' oki :) ')));
		}
	}
	logNewline();
};

export const reportFileBegin = (ctx: TestContext, fileId: string): void => {
	logNewline();
	ctx.log.plain('📁', toSourcePath(fileId));
};
export const reportFileEnd = (ctx: TestContext, fileId: string): void => {
	ctx.log.plain(
		ctx.reportBaseIndent,
		gray('🕒'),
		fmtMs(ctx.timings.get(fileId), 1),
	);
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
		red('\n!' + assertion.operator),
	);

	switch (assertion.operator) {
		case AssertionOperator.fail:
			log.plain(assertion.message);
			break;
		case AssertionOperator.throws:
			const logArgs: any[] = [];
			if (assertion.thrown) {
				if (assertion.matcher) {
					logArgs.push(
						formatUnmatchedErrorMessage(assertion.matcher, assertion.thrown),
					);
				}
				logArgs.push(
					'\n' + formatThrownError(assertion.thrown, reportFullStackTraces),
				);
			}
			log.plain(...logArgs);
			break;
		case AssertionOperator.ok:
			log.plain(fmtValue(assertion.value));
			break;
		case AssertionOperator.notOk:
			log.plain(fmtValue(assertion.value));
			break;
		case AssertionOperator.is:
			log.plain(fmtValue(assertion.actual));
			log.plain(fmtValue(assertion.expected));
			break;
		case AssertionOperator.isNot:
			log.plain(fmtValue(assertion.expected));
			break;
		case AssertionOperator.equal:
			log.plain(fmtValue(assertion.actual));
			log.plain(fmtValue(assertion.expected));
			break;
		case AssertionOperator.notEqual:
			log.plain(fmtValue(assertion.expected));
			break;
		default:
			throw new UnreachableError(assertion);
	}
	log.plain(
		formatAssertionError(error, assertion, reportFullStackTraces),
		'\n',
	);
};

const formatAssertionError = (
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
			return gray(
				`AssertionError: !${assertion.operator}\n` + parts.join('\n'),
			);
		} else {
			return gray(stack);
		}
	} else {
		return error.message;
	}
};

// TODO this is very brittle
const IGNORED_ERROR_LINE_PARTIAL = TestContext.name + '.';
const shouldIgnoreAssertionErrorLine = (s: string) =>
	s.includes(IGNORED_ERROR_LINE_PARTIAL);

const formatThrownError = (
	error: Error,
	reportFullStackTraces: boolean,
): string => {
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
const shouldIgnoreThrownErrorLine = (s: string) =>
	MATCH_IGNORED_ERROR_LINE.test(s);

const formatUnmatchedErrorMessage = (
	matcher: string | RegExp | ErrorClass,
	error: Error,
): string => {
	const strs: string[] = [];
	if (typeof matcher === 'string') {
		strs.push(
			formatMatcher(matcher),
			'is not a substring of error message',
			fmtStr(error.message),
		);
	} else if (matcher instanceof RegExp) {
		strs.push(
			formatMatcher(matcher),
			'does not match error message',
			fmtStr(error.message),
		);
	} else {
		strs.push(
			formatMatcher(matcher),
			'is not a superclass of thrown',
			cyan(error.name),
		);
	}
	return strs.join(' ');
};

const formatMatcher = (matcher: string | RegExp | ErrorClass): string => {
	if (typeof matcher === 'string') {
		return fmtStr(matcher);
	} else if (matcher instanceof RegExp) {
		return green(matcher.toString()); // default is red, but that's reserved for errors
	} else {
		return cyan(matcher.name);
	}
};
