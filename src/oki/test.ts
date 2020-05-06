import {
	TestContext,
	TestInstance,
	TestInstanceCallback,
} from './TestContext.js';

export const test = (
	message: string,
	cb: TestInstanceCallback,
): TestInstance => {
	if (!globalTestContext) {
		throw Error(
			`Cannot register test instance without a current test context. Was a test file mistakenly imported?`,
		);
	}
	return globalTestContext.registerTest(message, cb);
};

// This module-level reference allows test files
// to import the module-level `test` function to register tests.
let globalTestContext: TestContext | null = null;
export const setGlobalTestContext = (testContext: TestContext): void => {
	if (globalTestContext) {
		throw Error(`A global test context has already been set.`);
	}
	globalTestContext = testContext;
};
export const unsetGlobalTestContext = (testContext: TestContext): void => {
	if (globalTestContext !== testContext) {
		throw Error(
			`Trying to unset an inactive global test context: ${testContext} does not match the global ${globalTestContext}.`,
		);
	}
	globalTestContext = null;
};
