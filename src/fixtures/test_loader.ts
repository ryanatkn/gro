#!/usr/bin/env node

// Test script to verify the custom loader works correctly
// This runs in a separate Node.js process with the loader active

/* eslint-disable */

import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

const JSON_FIXTURE = 'src/fixtures/modules/some_test_json.json';
const JSON_WITHOUT_EXTENSION_FIXTURE = 'src/fixtures/modules/some_test_json_without_extension';

let passed = 0;
let failed = 0;

function assert(condition, message) {
	if (condition) {
		console.log(`✓ ${message}`);
		passed++;
	} else {
		console.error(`✗ ${message}`);
		failed++;
	}
}

function assertEqual(actual, expected, message) {
	const condition = JSON.stringify(actual) === JSON.stringify(expected);
	assert(
		condition,
		message +
			(condition ? '' : ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`),
	);
}

async function runTests() {
	console.log('Testing custom loader...\n');

	// Test 1: Import .js
	try {
		const imported = await import(resolve('src/fixtures/modules/some_test_ts.js'));
		assert(imported && imported.a === 'ok', 'import .js works');
	} catch (error) {
		assert(false, `import .js failed: ${error.message}`);
	}

	// Test 2: Import .ts
	try {
		const imported = await import(resolve('src/fixtures/modules/some_test_ts.ts'));
		assert(imported && imported.a === 'ok', 'import .ts works');
	} catch (error) {
		assert(false, `import .ts failed: ${error.message}`);
	}

	// Test 3: Import raw .ts
	try {
		const path = resolve('src/fixtures/modules/some_test_ts.ts');
		const imported = await import(path + '?raw');
		const expected = readFileSync(path, 'utf8');
		assertEqual(imported.default, expected, 'import raw .ts works');
	} catch (error) {
		assert(false, `import raw .ts failed: ${error.message}`);
	}

	// Test 4: Import .json with attribute
	try {
		const path = resolve(JSON_FIXTURE);
		const imported = await import(path, {with: {type: 'json'}});
		const expected = JSON.parse(readFileSync(path, 'utf8'));
		assert(imported && imported.default.a === 'ok', 'import .json with attribute works');
		assertEqual(imported.default, expected, 'import .json content matches');
	} catch (error) {
		assert(false, `import .json with attribute failed: ${error.message}`);
	}

	// Test 5: Import json without .json extension
	try {
		const path = resolve(JSON_WITHOUT_EXTENSION_FIXTURE);
		const imported = await import(path, {with: {type: 'json'}});
		const expected = JSON.parse(readFileSync(path, 'utf8'));
		assert(
			imported && imported.default.some_test_json_without_extension,
			'import json without extension works',
		);
		assertEqual(imported.default, expected, 'import json without extension content matches');
	} catch (error) {
		assert(false, `import json without extension failed: ${error.message}`);
	}

	// Test 6: Fail to import .json without attribute (should fail)
	try {
		await import(resolve(JSON_FIXTURE));
		assert(false, 'import .json without attribute should fail but succeeded');
	} catch (error) {
		assert(true, 'import .json without attribute correctly fails');
	}

	// Test 7: Import raw .css
	try {
		const path = resolve('src/fixtures/modules/some_test_css.css');
		const imported = await import(path);
		const expected = readFileSync(path, 'utf8');
		assert(typeof imported.default === 'string', 'import raw .css returns string');
		assertEqual(imported.default, expected, 'import raw .css content matches');
	} catch (error) {
		assert(false, `import raw .css failed: ${error.message}`);
	}

	// Test 8: Import .svelte
	try {
		const imported = await import(resolve('src/fixtures/modules/Some_Test_Svelte.svelte'));
		assert(imported && imported.a === 'ok', 'import .svelte works');
	} catch (error) {
		assert(false, `import .svelte failed: ${error.message}`);
	}

	// Test 9: Import raw .svelte
	try {
		const path = resolve('src/fixtures/modules/Some_Test_Svelte.svelte');
		const imported = await import(path + '?raw');
		const expected = readFileSync(path, 'utf8');
		assertEqual(imported.default, expected, 'import raw .svelte works');
	} catch (error) {
		assert(false, `import raw .svelte failed: ${error.message}`);
	}

	// Test 10: Import .svelte.js
	try {
		const imported = await import(resolve('src/fixtures/modules/some_test_svelte_js.svelte.js'));
		assert(imported && imported.Some_Test_Svelte_Js, 'import .svelte.js works');
		const instance = new imported.Some_Test_Svelte_Js();
		assert(instance.a === 'ok', 'import .svelte.js instance works');
	} catch (error) {
		assert(false, `import .svelte.js failed: ${error.message}`);
	}

	// Test 11: Import .svelte.ts
	try {
		const imported = await import(resolve('src/fixtures/modules/some_test_svelte_ts.svelte.ts'));
		assert(imported && imported.Some_Test_Svelte_Ts, 'import .svelte.ts works');
		const instance = new imported.Some_Test_Svelte_Ts();
		assert(instance.a === 'ok', 'import .svelte.ts instance works');
	} catch (error) {
		assert(false, `import .svelte.ts failed: ${error.message}`);
	}

	console.log(`\nResults: ${passed} passed, ${failed} failed`);
	if (failed > 0) {
		process.exit(1);
	}
}

runTests().catch((error) => {
	console.error('Test runner failed:', error);
	process.exit(1);
});
