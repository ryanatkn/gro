import {EventEmitter} from 'events';
import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {run_task} from './run_task.js';
import {fs} from '../fs/node.js';

/* test_run_task */
const test_run_task = suite('run_task');

test_run_task('passes args and returns output', async () => {
	const args = {a: 1, _: []};
	const result = await run_task(
		fs,
		{
			name: 'test_task',
			id: 'foo/test_task',
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

test_run_task('invokes a sub task', async () => {
	const args = {a: 1, _: []};
	let invoked_task_name;
	let invoked_args;
	const result = await run_task(
		fs,
		{
			name: 'test_task',
			id: 'foo/test_task',
			mod: {
				task: {
					run: async ({args, invoke_task}) => {
						invoke_task('bar/test_task', args);
						return args;
					},
				},
			},
		},
		args,
		new EventEmitter(),
		async (_fs, invokingTaskName, invokingArgs) => {
			invoked_task_name = invokingTaskName;
			invoked_args = invokingArgs;
		},
		true,
	);
	t.ok(result.ok);
	t.is(invoked_task_name, 'bar/test_task');
	t.is(invoked_args, args);
	t.is(result.output, args);
});

test_run_task('failing task', async () => {
	let err;
	const result = await run_task(
		fs,
		{
			name: 'test_task',
			id: 'foo/test_task',
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

test_run_task.run();
/* /test_run_task */
