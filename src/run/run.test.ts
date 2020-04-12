import {resolve, join} from 'path';

import {test, t} from '../oki/oki.js';
import {run} from './run.js';
import {paths, toBasePath} from '../paths.js';
import {toTaskName} from './task.js';

test('run()', async () => {
	test('without any task names', async () => {
		const result = await run(
			{
				logLevel: 0,
				host: {
					findTaskModules: async dir => {
						t.is(dir, paths.source);
						return [join(dir, 'foo/1.task.ts'), join(dir, 'foo/2.task.ts')];
					},
					loadTaskModule: async () => {
						throw Error('should not be called');
					},
				},
				dir: paths.source,
				taskNames: [],
				argv: {},
			},
			{test: 'data'},
		);
		t.ok(result.ok);
		t.equal(result.taskNames, ['foo/1', 'foo/2']);
		t.is(result.loadResults.length, 0);
		t.is(result.runResults.length, 0);
		t.equal(result.data, {test: 'data'});
	});

	test('with task names', async () => {
		const argv = {a: 1};
		const result = await run(
			{
				logLevel: 0,
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async sourceId => {
						t.ok(
							sourceId === resolve('src/foo/1.task.ts') ||
								sourceId === resolve('src/foo/2.task.ts'),
						);
						return {
							id: sourceId,
							name: toTaskName(toBasePath(sourceId)),
							mod: {
								task: {
									run: async (ctx, data) => {
										t.is(ctx.argv, argv);
										t.ok(ctx.log);
										return sourceId === resolve('src/foo/1.task.ts')
											? {a: 1, argv: ctx.argv}
											: {...data, b: 2};
									},
								},
							},
						};
					},
				},
				dir: paths.source,
				taskNames: ['foo/1', 'foo/2'],
				argv,
			},
			{test: 'data'},
		);
		t.ok(result.ok);
		t.ok(result.elapsed > 0);
		t.equal(result.taskNames, ['foo/1', 'foo/2']);
		t.is(result.loadResults.length, 2);
		t.is(result.runResults.length, 2);
		t.equal(result.data, {
			a: 1,
			b: 2,
			argv,
		});

		test('missing task', async () => {
			const result = await run({
				logLevel: 0,
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async sourceId => {
						if (sourceId.includes('foo/MISSING_TASK')) {
							throw Error('testing missing module');
						}
						return {
							id: sourceId,
							name: toTaskName(toBasePath(sourceId)),
							mod: {
								task: {
									run: async () => {
										throw Error('should not be called');
									},
								},
							},
						};
					},
				},
				dir: paths.source,
				taskNames: ['foo/1', 'foo/MISSING_TASK', 'foo/2'],
				argv: {},
			});
			t.notOk(result.ok);
			t.is(result.loadResults.length, 3);
			t.ok(result.loadResults[0].ok);
			t.notOk(result.loadResults[1].ok);
			t.ok(result.loadResults[2].ok);
			t.is(result.runResults.length, 0);
		});

		test('invalid task', async () => {
			const result = await run({
				logLevel: 0,
				host: {
					findTaskModules: async () => {
						throw Error('should not be called');
					},
					loadTaskModule: async sourceId => {
						return {
							id: sourceId,
							name: toTaskName(toBasePath(sourceId)),
							mod: sourceId.includes('foo/INVALID_TASK')
								? ({
										run: async () => {
											throw Error('should not be called');
										},
								  } as any)
								: {
										task: {
											run: async () => {
												throw Error('should not be called');
											},
										},
								  },
						};
					},
				},
				dir: paths.source,
				taskNames: ['foo/1', 'foo/INVALID_TASK', 'foo/2'],
				argv: {},
			});
			t.notOk(result.ok);
			t.is(result.loadResults.length, 3);
			t.ok(result.loadResults[0].ok);
			t.notOk(result.loadResults[1].ok);
			t.ok(result.loadResults[2].ok);
			t.is(result.runResults.length, 0);
		});

		test('failing task', async () => {
			const result = await run({
				logLevel: 0,
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
									run: sourceId.includes('foo/FAILING_TASK')
										? async () => {
												throw Error('testing failing task');
										  }
										: sourceId.includes('foo/1')
										? async () => {}
										: async () => {
												throw Error('should not be called');
										  },
								},
							},
						} as any;
					},
				},
				dir: paths.source,
				taskNames: ['foo/1', 'foo/FAILING_TASK', 'foo/2'],
				argv: {},
			});
			t.notOk(result.ok);
			t.is(result.loadResults.length, 3);
			t.ok(result.loadResults[0].ok);
			t.ok(result.loadResults[1].ok);
			t.ok(result.loadResults[2].ok);
			t.is(result.runResults.length, 2);
			t.ok(result.runResults[0].ok);
			t.notOk(result.runResults[1].ok);
		});
	});
});
