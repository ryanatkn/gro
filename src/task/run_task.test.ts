import {EventEmitter} from 'events';
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {runTask} from './runTask.js';
import {fs} from '../fs/node.js';

/* test_runTask */
const test_runTask = suite('runTask');

test_runTask('passes args and returns output', async () => {
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
	t.ok(result.ok);
	t.is(result.output, args);
});

test_runTask('invokes a sub task', async () => {
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
					run: async ({args, invoke_task}) => {
						invoke_task('bar/testTask', args);
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
	t.ok(result.ok);
	t.is(invokedTaskName, 'bar/testTask');
	t.is(invokedArgs, args);
	t.is(result.output, args);
});

test_runTask('failing task', async () => {
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
	t.not.ok(result.ok);
	t.ok(result.reason);
	t.is(result.error, err);
});

test_runTask.run();
/* /test_runTask */
