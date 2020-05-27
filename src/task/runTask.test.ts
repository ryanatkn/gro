import {test, t} from '../oki/oki.js';
import {runTask} from './runTask.js';

test('runTask()', () => {
	test('passes args and returns output', async () => {
		const args = {a: 1, _: []};
		const result = await runTask(
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
			async () => {},
		);
		t.ok(result.ok);
		t.is(result.output, args);
	});

	test('invokes a sub task', async () => {
		const args = {a: 1, _: []};
		let invokedTaskName;
		let invokedArgs;
		const result = await runTask(
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
			async (invokingTaskName, invokingArgs) => {
				invokedTaskName = invokingTaskName;
				invokedArgs = invokingArgs;
			},
		);
		t.ok(result.ok);
		t.is(invokedTaskName, 'bar/testTask');
		t.is(invokedArgs, args);
		t.is(result.output, args);
	});

	test('failing task', async () => {
		let err;
		const result = await runTask(
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
			async () => {},
		);
		t.ok(!result.ok);
		t.ok(result.reason);
		t.is(result.error, err);
	});
});
