#!/usr/bin/env node

// Test script that should fail when the loader encounters invalid files
// This deliberately tries to import invalid files to test loader error handling

/* eslint-disable */

import {resolve} from 'node:path';

async function runFailureTest() {
	console.log('Testing that loader fails on invalid files...\n');

	// This should fail - try to import a file with invalid TypeScript syntax
	try {
		console.log('Attempting to import invalid TypeScript file...');
		await import(resolve('src/fixtures/modules/invalid_syntax.ts'));
		console.log('ERROR: Import succeeded when it should have failed!');
		process.exit(1);
	} catch (error) {
		console.log('✓ Import correctly failed with error:', error.message);
		// Exit with error code to indicate the loader properly failed
		process.exit(1);
	}
}

runFailureTest().catch((error) => {
	console.error('Failure test failed unexpectedly:', error);
	process.exit(1);
});
