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
			process.env,
		);
		t.ok(result.ok);
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
			process.env,
		);
		t.ok(!result.ok);
		t.ok(result.reason);
		t.is(result.error, err);
	});
});
