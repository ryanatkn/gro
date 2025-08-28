#!/usr/bin/env node

// Test script to verify run_task invokes sub tasks
// This runs in a separate Node.js process with the loader active

/* eslint-disable */

import {Timings} from '@ryanatkn/belt/timings.js';

import {run_task} from '../lib/run_task.ts';
import {load_gro_config} from '../lib/gro_config.ts';
import {Filer} from '../lib/filer.ts';

async function runTest() {
	console.log('Testing run_task invokes sub tasks...\n');

	const args = {a: 1, _: []};
	let invoked_task_name;
	let invoked_args;
	const filer = new Filer();
	const result = await run_task(
		{
			name: 'testTask',
			id: 'foo/testTask',
			mod: {
				task: {
					run: async ({args, invoke_task}) => {
						await invoke_task('bar/testTask', args);
						return args;
					},
				},
			},
		},
		args,
		(invoking_task_name, invoking_args) => {
			invoked_task_name = invoking_task_name;
			invoked_args = invoking_args;
			return Promise.resolve();
		},
		await load_gro_config(),
		filer,
		new Timings(),
	);
	filer.close();

	const success =
		result.ok &&
		invoked_task_name === 'bar/testTask' &&
		invoked_args === args &&
		result.output === args;

	if (success) {
		console.log('✓ Test passed: run_task correctly invokes sub tasks');
		process.exit(0);
	} else {
		console.error('✗ Test failed: run_task did not correctly invoke sub tasks');
		console.error('Result:', result);
		console.error('Invoked task name:', invoked_task_name);
		console.error('Invoked args:', invoked_args);
		process.exit(1);
	}
}

runTest().catch((error) => {
	console.error('Test failed with error:', error);
	process.exit(1);
});
