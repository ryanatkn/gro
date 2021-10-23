import {EventEmitter} from 'events';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {runTask} from './runTask.js';
import {fs} from '../fs/node.js';

/* testRunTask */
const testRunTask = suite('runTask');

testRunTask('passes args and returns output', async () => {
	const args = {a: 1, _: []};
	const result = await runTask(
		fs,
		{
			name: 'testTask',
			id: 'foo/testTask',
			mod: {
				task: {
					run: async ({args}) => args,
				},
			},
		},
		args,
		new EventEmitter(),
		async () => {},
		true,
	);
	assert.ok(result.ok);
	assert.is(result.output, args);
});

testRunTask('invokes a sub task', async () => {
	const args = {a: 1, _: []};
	let invokedTaskName;
	let invokedArgs;
	const result = await runTask(
		fs,
		{
			name: 'testTask',
			id: 'foo/testTask',
			mod: {
				task: {
					run: async ({args, invokeTask}) => {
						invokeTask('bar/testTask', args);
						return args;
					},
				},
			},
		},
		args,
		new EventEmitter(),
		async (_fs, invokingTaskName, invokingArgs) => {
			invokedTaskName = invokingTaskName;
			invokedArgs = invokingArgs;
		},
		true,
	);
	assert.ok(result.ok);
	assert.is(invokedTaskName, 'bar/testTask');
	assert.is(invokedArgs, args);
	assert.is(result.output, args);
});

testRunTask('failing task', async () => {
	let err;
	const result = await runTask(
		fs,
		{
			name: 'testTask',
			id: 'foo/testTask',
			mod: {
				task: {
					run: async () => {
						err = Error();
						throw err;
					},
				},
			},
		},
		{_: []},
		new EventEmitter(),
		async () => {},
		true,
	);
	assert.not.ok(result.ok);
	assert.ok(result.reason);
	assert.is(result.error, err);
});

testRunTask.run();
/* /testRunTask */
