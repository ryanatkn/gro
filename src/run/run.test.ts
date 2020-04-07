import {test} from '../oki/index.js';
import {run} from './run.js';
import {paths} from '../paths.js';
import {createNodeRunHost} from './nodeRunHost.js';

test('run()', async t => {
	test('without any task names', async () => {
		const result = await run(
			{
				logLevel: 0,
				host: createNodeRunHost({logLevel: 0}),
				dir: paths.source,
				taskNames: [],
				argv: {},
			},
			{test: 'data'},
		);
		t.ok(result.ok);
		t.ok(result.taskNames.length); // TODO convert to `t.gt`
		t.is(result.loadResults.length, 0);
		t.is(result.runResults.length, 0);
		t.equal(result.data, {test: 'data'});
	});

	test('with task names', async () => {
		const result = await run(
			{
				logLevel: 0,
				host: createNodeRunHost({logLevel: 0}),
				dir: paths.source,
				taskNames: ['run/fixtures/testTask1', 'run/fixtures/testTask2'],
				argv: {flag: true},
			},
			{test: 'data'},
		);
		t.ok(result.ok);
		t.ok(result.elapsed > 0);
		t.is(result.taskNames.length, 2);
		t.is(result.loadResults.length, 2);
		t.is(result.runResults.length, 2);
		t.equal(result.data, {
			test: 'data',
			foo: 2,
			bar: 'baz',
			argv: {flag: true}, // gets forwarded by 'run/fixtures/testTask1'
		});

		test('missing task', async () => {
			const result = await run({
				logLevel: 0,
				host: createNodeRunHost({logLevel: 0}),
				dir: paths.source,
				taskNames: [
					'run/fixtures/testTask1',
					'run/fixtures/MISSING_TASK',
					'run/fixtures/testTask2',
				],
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
				host: createNodeRunHost({logLevel: 0}),
				dir: paths.source,
				taskNames: [
					'run/fixtures/testTask1',
					'run/fixtures/testInvalidTask',
					'run/fixtures/testTask2',
				],
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
				host: createNodeRunHost({logLevel: 0}),
				dir: paths.source,
				taskNames: [
					'run/fixtures/testTask1',
					'run/fixtures/testFailingTask',
					'run/fixtures/testTask2',
				],
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
