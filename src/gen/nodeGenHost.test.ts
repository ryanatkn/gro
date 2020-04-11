import {resolve, join} from 'path';

import {test} from '../oki/index.js';
import {createNodeGenHost} from './nodeGenHost.js';
import {validateGenModule} from './gen.js';

test('createNodeGenHost()', t => {
	const host = createNodeGenHost({logLevel: 0});
	const fixturesDir = resolve('src/gen/fixtures');

	test('host.findGenModules()', async () => {
		const genSourceIds = await host.findGenModules(fixturesDir);
		t.equal(genSourceIds, [
			join(fixturesDir, 'testGenHtml.gen.html.ts'),
			join(fixturesDir, 'testGenMulti.gen.ts'),
			join(fixturesDir, 'testGenTs.gen.ts'),
		]);
	});

	test('host.loadGenModule()', async () => {
		const id = join(fixturesDir, 'testGenTs.gen.ts');
		const gen = await host.loadGenModule(id);
		t.is(gen.id, id);
		t.ok(validateGenModule(gen.mod));
	});
});
