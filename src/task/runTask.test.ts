import {EventEmitter} from 'events';
import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {runTask} from './runTask.js';
import {fs} from '../fs/node.js';

/* test__runTask */
const test__runTask = suite('runTask');

test__runTask('passes args and returns output', async () => {
	const args = {a: 1, _: []};
	const result = await runTask(
		fs,
		{
			name: 'testTask',
			id: 'foo/testTask',
			mod: {
				task: {
					run: ({args}) => Promise.resolve(args),
				},
			},
		},
		args,
		new EventEmitter(),
		() => Promise.resolve(),
	);
	assert.ok(result.ok);
	assert.is(result.output, args);
});

test__runTask('invokes a sub task', async () => {
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
						await invokeTask('bar/testTask', args);
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
	);
	assert.ok(result.ok);
	assert.is(invokedTaskName, 'bar/testTask');
	assert.is(invokedArgs, args);
	assert.is(result.output, args);
});

test__runTask('failing task', async () => {
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
		async () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
	);
	assert.ok(!result.ok);
	assert.ok(result.reason);
	assert.is(result.error, err);
});

test__runTask.run();
/* test__runTask */
