import {cyan} from '../colors/terminal.js';
import {LogLevel, Logger, logger} from '../utils/logUtils.js';
import {AsyncState} from '../utils/asyncUtils.js';
import {omitUndefined} from '../utils/objectUtils.js';
import {assertionsThatThrow, AssertionsThatThrow} from './assertions.js';
import {createFileCache} from '../project/fileCache.js';
import {Timings} from '../utils/timeUtils.js';

export type TestInstanceContext = AssertionsThatThrow & {
	log: Logger;
};
export interface TestInstanceCreator {
	(message: string, cb: TestInstanceCallback): void;
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
	dir: string;
	watch: boolean;
	logLevel: LogLevel; // TODO should this be a logger instance instead?
	logPrefix: string;
	reportFullStackTraces: boolean;
	reportBaseIndent: string;
	reportListIndent: string;
}
export type RequiredOptions = 'dir';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	const logPrefix = opts.logPrefix === undefined ? '[oki]' : opts.logPrefix;
	return {
		// TODO use rollup-style globbing? probably, because of watch mode
		// include: '**/*.test.*',
		// exclude: null,
		watch: false,
		logLevel: LogLevel.Info,
		logPrefix,
		reportFullStackTraces: false,
		reportBaseIndent: '   ',
		reportListIndent: '  ',
		...omitUndefined(opts),
	};
};

export abstract class TestContext<
	O extends Options = Options,
	I extends InitialOptions = InitialOptions
> {
	readonly options: O;
	readonly dir: string;
	readonly watch: boolean;
	readonly log: Logger;
	readonly reportFullStackTraces: boolean;
	readonly reportBaseIndent: string;
	readonly reportListIndent: string;

	readonly testInstanceContext: TestInstanceContext;
	readonly testsByFileId = new Map<string, TestInstance[]>();
	readonly tests: TestInstance[] = []; // flat array of tests in call order - fast alternative to traversing `testsByFileId`

	stats: TestStats | undefined;
	readonly files = createFileCache();
	readonly timings = new Timings();

	protected abstract readonly report: TestReporter;
	protected abstract async importTestModule(id: string): Promise<object>;
	private async importModule(id: string): Promise<object> {
		const importedModule = await this.importTestModule(id);
		return importedModule;
	}

	constructor(opts: I, initOpts: (o: I) => O) {
		this.options = initOpts(opts);
		const {
			dir,
			watch,
			logLevel,
			logPrefix,
			reportFullStackTraces,
			reportBaseIndent,
			reportListIndent,
		} = this.options;
		if (watch) throw Error(`Test watching is not yet supported`);
		this.dir = dir;
		this.watch = watch;
		this.log = logger(logLevel, [cyan(logPrefix)]);
		this.reportFullStackTraces = reportFullStackTraces;
		this.reportBaseIndent = reportBaseIndent;
		this.reportListIndent = reportListIndent;
		this.testInstanceContext = {
			log: this.log,
			...assertionsThatThrow,
		};
	}

	initState = AsyncState.Initial;
	async init(): Promise<void> {
		if (this.initState !== AsyncState.Initial) {
			throw Error(`TestContext was already inited`);
		}
		this.initState = AsyncState.Pending;
		try {
			await this.start();
		} catch (err) {
			this.initState = AsyncState.Failure;
			throw err;
		}
		this.initState = AsyncState.Success;
	}

	protected abstract async start(): Promise<void>;
	// TODO call this when?
	// TODO state machine seems useful here ... `close` makes no sense in many states
	protected abstract async stop(): Promise<void>;

	// TODO re-run?
	runState = AsyncState.Initial;
	async run(): Promise<void> {
		if (this.initState !== AsyncState.Success) {
			throw Error(`TestContext is not inited`);
		}
		if (this.runState !== AsyncState.Initial) {
			throw Error(`TestContext was already run`);
		}
		this.runState = AsyncState.Pending;
		try {
			await this.runTests();
		} catch (err) {
			this.runState = AsyncState.Failure;
			throw err;
		}
		this.runState = AsyncState.Success;
	}

	private async runTests(): Promise<void> {
		this.onRunStart();

		// TODO maybe track import timing separately? or hierarchically?
		await this.importTests();

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

		this.onRunEnd();
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

	private onRunStart(): void {
		if (TestContext.currentTestContext !== undefined) {
			throw Error(
				`A static currentTestContext has already been set. Are multiple TestContexts running in parallel, or was one not cleaned up?`,
			);
		}
		TestContext.currentTestContext = this; // track this `TestContext` instance so `test` knows how to register
		this.report.reportIntro(this);
		this.timings.start(TOTAL_TIMING);
	}
	private onRunEnd(): void {
		this.timings.stop(TOTAL_TIMING);
		this.report.reportSummary(this);
		TestContext.currentTestContext = undefined;
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
	static currentTestContext: TestContext | undefined;
	currentFileId: string | undefined;
	currentTestInstance: TestInstance | undefined;

	static test(message: string, cb: TestInstanceCallback): TestInstance {
		const {currentTestContext} = TestContext;
		if (!currentTestContext) {
			throw Error(
				`Cannot register test instance without a current test context. Was a test file mistakenly imported?`,
			);
		}
		return currentTestContext.test(message, cb);
	}

	// This function registers (but doesn't run) a test instance.
	// It may be called when a module is imported, (no `parent`)
	// or when individual test instance callbacks are called. (has a `parent`).
	test(message: string, cb: TestInstanceCallback): TestInstance {
		const {currentFileId, currentTestInstance: parent} = this;
		if (currentFileId === undefined && !parent) {
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

	private async importTests(): Promise<void> {
		// TODO parallelizing is tricky because of `currentFileId` - maybe just use sync `require`?
		for (const file of this.files.byId.values()) {
			if (file.stats.isDirectory()) continue;
			this.currentFileId = file.id; // see how this is used for tracking above
			await this.importModule(file.id);
		}
		this.currentFileId = undefined;
	}
}

export const test = TestContext.test;

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
