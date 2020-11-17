import {test, t} from '../oki/oki.js';
import {loadGroConfig} from './config.js';

test('loadGroConfig()', async () => {
	const config = await loadGroConfig();
	t.ok(config);
});
