import {resolve, join} from 'path';
import fs from 'fs-extra';
const {readFile, remove} = fs; // TODO esm

import {test, t} from '../oki/oki.js';
import {createNodeGenHost} from './nodeGenHost.js';
import {validateGenModule} from './gen.js';
import {paths} from '../paths.js';

test('createNodeGenHost()', () => {
	const host = createNodeGenHost();
	const fixturesDir = resolve('src/gen/fixtures');

	test('host.findGenModules()', async () => {
		const genSourceIds = (await host.findGenModules(fixturesDir)).sort();
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

	test('host.outputFile()', async () => {
		const tempId = join(paths.temp, 'testHostOutputFile.ts');
		const contents = Math.random().toString();
		await host.outputFile({
			id: tempId,
			originId: join(paths.temp, 'fakeOrigin.gen.ts'),
			contents,
		});
		const fileOnDisk = await readFile(tempId, 'utf8');
		t.is(fileOnDisk, contents);
		await remove(tempId);
	});
});
