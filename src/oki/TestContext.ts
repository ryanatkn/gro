import {cyan} from '../colors/terminal.js';
import {Logger, LogLevel, SystemLogger} from '../utils/log.js';
import {AsyncState} from '../utils/async.js';
import {omitUndefined} from '../utils/object.js';
import {createFileCache} from '../project/fileCache.js';
import {Timings} from '../utils/time.js';
import {TestModuleMeta, loadTestModule} from './testModule.js';
import {LoadModuleResult} from '../fs/modules.js';
import {setGlobalTestContext, unsetGlobalTestContext} from './test.js';

export class TestLogger extends Logger {
	static level = LogLevel.Trace;
	constructor(
		prefixes: readonly any[] = [cyan('[oki]')],
		suffixes?: readonly any[],
	) {
		super(prefixes, suffixes, TestLogger);
	}
}

export interface TestInstance {
	fileId: string;
	message: string;
	cb: TestInstanceCallback;
	parent: TestInstance | undefined;
	children: TestInstance[];
	depth: number;
	result: TestResult | undefined;
}
export interface TestInstanceCallback {
	(testInstanceContext: TestInstanceContext): Promise<void> | void;
}
export interface TestInstanceContext {
	log: Logger;
}

export type TestResult = TestResultSuccess | TestResultFailure;
export type TestResultSuccess = {
	ok: true;
};
export type TestResultFailure = {
	ok: false;
	error: Error; // is an `AssertionError` or some runtime error
};
export interface TestStats {
	passCount: number;
	failCount: number;
}

export interface TestRunResult {
	timings: Timings<TestRunTimings>;
}
export type TestRunTimings = 'total';

// TODO make these async?
// TODO maybe trigger events instead of these callbacks?
export interface TestReporter {
	reportIntro(ctx: TestContext): void;
	reportFileBegin(ctx: TestContext, fileId: string): void;
	reportFileEnd(ctx: TestContext, fileId: string): void;
	reportResult(ctx: TestContext, testInstance: TestInstance): void;
	reportSummary(ctx: TestContext): void;
}

export const TOTAL_TIMING = 'total';

export interface Options {
	log: Logger;
	report: TestReporter;
	reportFullStackTraces: boolean;
	reportBaseIndent: string;
	reportListIndent: string;
}
export type RequiredOptions = 'report';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		log: new TestLogger(),
		reportFullStackTraces: false,
		reportBaseIndent: '   ',
		reportListIndent: '  ',
		...omitUndefined(opts),
	};
};

export class TestContext {
	readonly options: Options;
	readonly log: Logger;
	readonly report: TestReporter;
	readonly reportFullStackTraces: boolean;
	readonly reportBaseIndent: string;
	readonly reportListIndent: string;

	readonly testInstanceContext: TestInstanceContext;
	readonly testsByFileId = new Map<string, TestInstance[]>();
	readonly tests: TestInstance[] = []; // flat array of tests in call order - fast alternative to traversing `testsByFileId`

	stats: TestStats | undefined;
	// TODO probably pass this in as an option
	// what if we have a thing that's like a FileSelection, taking in Files and a filter, and caching to maps? or maybe just use a set of ids?
	readonly files = createFileCache();
	readonly timings = new Timings();

	constructor(opts: InitialOptions) {
		this.options = initOptions(opts);
		const {
			log,
			report,
			reportFullStackTraces,
			reportBaseIndent,
			reportListIndent,
		} = this.options;
		this.log = log;
		this.report = report;
		this.reportFullStackTraces = reportFullStackTraces;
		this.reportBaseIndent = reportBaseIndent;
		this.reportListIndent = reportListIndent;
		this.testInstanceContext = {log};
	}

	// TODO re-run?
	runState = AsyncState.Initial;
	async run(): Promise<TestRunResult> {
		const timings = new Timings<TestRunTimings>();
		timings.start('total');
		if (this.runState !== AsyncState.Initial) {
			throw Error(`TestContext was already run`);
		}
		this.runState = AsyncState.Pending;
		this.onRunBegin();
		try {
			await this.runTests();
		} catch (err) {
			this.runState = AsyncState.Failure;
			this.onRunEnd();
			throw err;
		}
		this.runState = AsyncState.Success;
		this.onRunEnd();
		timings.stop('total');
		return {timings};
	}

	private async runTests(): Promise<void> {
		// At this point `testsByFileId` has
		// all top-level synchronously-added test instances.
		for (const [fileId, testInstances] of this.testsByFileId) {
			this.onFileBegin(fileId);
			for (const testInstance of testInstances) {
				await this.runTest(testInstance);
			}
			this.onFileEnd(fileId);
		}
		this.stats = createTestStats(this.tests);
	}

	private async runTest(testInstance: TestInstance): Promise<void> {
		this.onTestBegin(testInstance);
		testInstance.result = await this.callTestInstance(testInstance);
		this.onTestEnd(testInstance);

		// Recursively run any tests added during `this.callTestInstance`.
		for (const childInstance of testInstance.children) {
			await this.runTest(childInstance);
		}
	}

	private async callTestInstance(
		testInstance: TestInstance,
	): Promise<TestResult> {
		try {
			const prevTestInstance = this.currentTestInstance;
			this.currentTestInstance = testInstance;
			await testInstance.cb(this.testInstanceContext);
			this.currentTestInstance = prevTestInstance;
		} catch (err) {
			return {ok: false, error: err};
		}
		return {ok: true};
	}

	// While running tests, we turn off logging for all `Logger` instances.
	// This property tracks the original value so we can reset it afterwards.
	// TODO how can custom loggers easily have the same behavior?
	private originalGlobalLogLevel = Logger.level;
	private originalSystemLogLevel = SystemLogger.level;

	private onRunBegin(): void {
		setGlobalTestContext(this);
		this.originalGlobalLogLevel = Logger.level;
		this.originalSystemLogLevel = SystemLogger.level;
		Logger.level = LogLevel.Off;
		SystemLogger.level = LogLevel.Off;
		this.timings.start(TOTAL_TIMING);
		this.report.reportIntro(this);
	}
	private onRunEnd(): void {
		Logger.level = this.originalGlobalLogLevel;
		SystemLogger.level = this.originalSystemLogLevel;
		this.timings.stop(TOTAL_TIMING);
		this.report.reportSummary(this);
		unsetGlobalTestContext(this);
	}
	private onFileBegin(fileId: string): void {
		this.report.reportFileBegin(this, fileId);
		this.timings.start(fileId);
	}
	private onFileEnd(fileId: string): void {
		this.timings.stop(fileId);
		this.report.reportFileEnd(this, fileId);
	}
	private onTestBegin(testInstance: TestInstance): void {
		this.tests.push(testInstance);
	}
	private onTestEnd(testInstance: TestInstance): void {
		this.report.reportResult(this, testInstance);
	}

	// These are used to assiciate module-level `test(...)` calls in test files
	// with their importing TestContext and file id.
	currentTestInstance: TestInstance | undefined;
	// `null` means we're importing but haven't imported anything yet
	currentFileId: string | null | undefined;

	// This function registers (but doesn't run) a test instance.
	// It may be called when a module is imported, (no `parent`)
	// or when individual test instance callbacks are called. (has a `parent`).
	registerTest(message: string, cb: TestInstanceCallback): TestInstance {
		const {currentFileId, currentTestInstance: parent} = this;
		if (!currentFileId && !parent) {
			throw Error(`Current test context has no parent or current file id.`);
		}
		const fileId = parent ? parent.fileId : currentFileId!;
		const testInstance: TestInstance = {
			fileId,
			message,
			cb,
			children: [],
			parent,
			depth: parent ? parent.depth + 1 : 0,
			result: undefined,
		};
		if (parent) {
			parent.children.push(testInstance);
		} else {
			let siblings = this.testsByFileId.get(fileId);
			if (!siblings) {
				this.testsByFileId.set(fileId, (siblings = []));
			}
			siblings.push(testInstance);
		}

		return testInstance;
	}

	/*

	To import test files, first call `beginImporting`,
	and when finished call its returned callback.
	This design decouples the importing workflow
	from the test context's internals.

	Example:

	const finishImporting = testContext.beginImporting();
	// import everything
	finishImporting();

	*/
	beginImporting() {
		if (this.currentFileId !== undefined) {
			throw Error(`Cannot begin importing - currentFieldId is already set.`);
		}
		this.currentFileId = null; // indicates we're importing
		setGlobalTestContext(this);
		return () => {
			unsetGlobalTestContext(this);
			if (this.currentFileId === undefined) {
				throw Error(`Cannot finish importing - currentFieldId is not set.`);
			}
			this.currentFileId = undefined;
		};
	}
	async importModule(id: string): Promise<LoadModuleResult<TestModuleMeta>> {
		if (this.currentFileId === undefined) {
			throw Error(`Cannot import test module before calling "beginImporting".`);
		}
		this.currentFileId = id; // see how this is used for tracking above
		return loadTestModule(id);
	}
}

const createTestStats = (tests: TestInstance[]): TestStats => {
	let passCount = 0;
	let failCount = 0;
	for (const test of tests) {
		if (test.result!.ok) {
			passCount++;
		} else {
			failCount++;
		}
	}
	return {passCount, failCount};
};
