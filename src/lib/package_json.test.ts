import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {PackageJson, load_package_json} from './package_json.js';

test('load_package_json', async () => {
	const pkg = await load_package_json();
	assert.ok(pkg);
	const parsed = PackageJson.parse(pkg);
	assert.ok(parsed);
});

test.run();
