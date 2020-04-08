import {resolve} from 'path';

import {test} from '../oki/index.js';
import {createNodeGenHost} from './nodeGenHost.js';
import {validateGenModule} from './gen.js';

test('createNodeGenHost()', t => {
	const host = createNodeGenHost({logLevel: 0});

	test('host.findGenModules()', async () => {
		const genSourceIds = await host.findGenModules(resolve('src/gen/fixtures'));
		t.equal(genSourceIds, [
			resolve('src/gen/fixtures/testGenHtml.gen.html.ts'),
			resolve('src/gen/fixtures/testGenMulti.gen.ts'),
			resolve('src/gen/fixtures/testGenTs.gen.ts'),
		]);
	});

	test('host.loadGenModule()', async () => {
		const gen = await host.loadGenModule(
			resolve('src/gen/fixtures/testGenTs.gen.ts'),
		);
		t.is(gen.id, resolve('src/gen/fixtures/testGenTs.gen.ts'));
		t.ok(validateGenModule(gen.mod));
	});
});
