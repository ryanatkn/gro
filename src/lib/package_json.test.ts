import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {PackageJson, load_package_json, serialize_package_json} from './package_json.js';

test('load_package_json', async () => {
	const pkg = await load_package_json();
	assert.ok(pkg);
	const parsed = PackageJson.parse(pkg);
	assert.ok(parsed);
	serialize_package_json(pkg);
});

test('PackageJson.parse', async () => {
	PackageJson.parse({name: 'abc', version: '123'});
});

test('PackageJson.parse fails with bad data', async () => {
	let err;
	try {
		PackageJson.parse({version: '123'});
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test('serialize_package_json', async () => {
	serialize_package_json({name: 'abc', version: '123'});
});

test('serialize_package_json fails with bad data', async () => {
	let err;
	try {
		serialize_package_json({version: '123'} as any);
	} catch (_err) {
		err = _err;
	}
	assert.ok(err);
});

test.run();
