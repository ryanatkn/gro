import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {run} from './run.js';
import {paths, toBasePath} from '../paths.js';
import {toTaskName} from './task.js';

test('run()', async () => {
	test('without any task names', async () => {
		let calledFindTaskModules = false;
		const result = await run({
			host: {
				findTaskModules: async dir => {
					calledFindTaskModules = true;
					t.is(dir, paths.source);
					return [join(dir, 'foo/bar.task.ts')];
				},
				loadTaskModule: async () => {
					throw Error('should not be called');
				},
			},
			dir: paths.source,
			taskName: undefined,
			args: {_: []},
		});
		t.ok(calledFindTaskModules);
		t.ok(result.ok);
		t.equal(result.taskName, undefined);
		t.is(result.loadResult, undefined);
		t.is(result.runResult, undefined);
	});

	test('with task name', async () => {
		const args = {_: [], a: 1};
		const result = await run({
			host: {
				findTaskModules: async () => {
					throw Error('should not be called');
				},
				loadTaskModule: async sourceId => {
					t.is(sourceId, resolve('src/foo/bar.task.ts'));
					return {
						id: sourceId,
						name: toTaskName(toBasePath(sourceId)),
						mod: {
							task: {
								run: async ctx => {
									t.is(ctx.args, args);
									t.ok(ctx.log);
									return 'return value';
								},
							},
						},
					};
				},
			},
			dir: paths.source,
			taskName: 'foo/bar',
			args,
		});
		t.ok(result.ok);
		t.ok(result.elapsed > 0);
		t.equal(result.taskName, 'foo/bar');
		t.ok(result.loadResult?.ok);
		t.ok(result.runResult?.ok);
		t.is(result.runResult.taskName, 'foo/bar');
		t.is(result.runResult.result, 'return value');

		test('missing task', async () => {
			const result = await run({
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async () => {
						throw Error('testing missing module');
					},
				},
				dir: paths.source,
				taskName: 'foo/MISSING_TASK',
				args: {_: []},
			});
			t.notOk(result.ok);
			t.ok(result.loadResult);
			t.ok(!result.loadResult.ok);
			t.is(result.loadResult.taskName, 'foo/MISSING_TASK');
			t.ok(result.loadResult.error);
			t.ok(result.loadResult.reason);
			t.is(result.runResult, undefined);
		});

		test('invalid task', async () => {
			const result = await run({
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async sourceId => {
						return {
							id: sourceId,
							name: toTaskName(toBasePath(sourceId)),
							mod: {
								run: async () => {
									throw Error('should not be called');
								},
							} as any,
						};
					},
				},
				dir: paths.source,
				taskName: 'foo/INVALID_TASK',
				args: {_: []},
			});
			t.notOk(result.ok);
			t.ok(result.loadResult);
			t.ok(!result.loadResult.ok);
			t.is(result.loadResult.taskName, 'foo/INVALID_TASK');
			t.ok(result.loadResult.error);
			t.ok(result.loadResult.reason);
			t.is(result.runResult, undefined);
		});

		test('failing task', async () => {
			const result = await run({
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async sourceId => {
						return {
							id: sourceId,
							name: toTaskName(toBasePath(sourceId)),
							mod: {
								task: {
									run: async () => {
										throw Error('testing failing task');
									},
								},
							},
						} as any;
					},
				},
				dir: paths.source,
				taskName: 'foo/FAILING_TASK',
				args: {_: []},
			});
			t.notOk(result.ok);
			t.ok(result.loadResult);
			t.ok(result.loadResult.ok);
			t.ok(result.runResult);
			t.ok(!result.runResult.ok);
			t.is(result.runResult.taskName, 'foo/FAILING_TASK');
			t.ok(result.runResult.error);
			t.ok(result.runResult.reason);
		});
	});
});
