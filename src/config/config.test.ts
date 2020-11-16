import {test, t} from '../oki/oki.js';
import {paths} from '../paths.js';
import {loadConfig, loadConfigFor, loadInternalConfig} from './config.js';

// TODO fix all of this with the new API
test('loadConfig()', async () => {
	const c1 = await loadConfig();
	const c2 = await loadInternalConfig();
	t.is(c2, c1);

	test('loadConfigAt()', async () => {
		const c4 = await loadConfigFor(paths.source);
		t.is(c4, c1);
	});
});
