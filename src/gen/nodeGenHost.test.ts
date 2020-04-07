import {resolve} from 'path';

import {test} from '../oki/index.js';
import {createNodeGenHost} from './nodeGenHost.js';

test('createNodeGenHost()', t => {
	const host = createNodeGenHost({logLevel: 0});

	test('host.loadModules()', async () => {
		const modules = await host.loadModules(resolve('src/gen/fixtures'));
		t.ok(modules.length);
	});
});
