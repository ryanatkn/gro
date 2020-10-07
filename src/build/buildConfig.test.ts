import {test, t} from '../oki/oki.js';
import {paths} from '../paths.js';
import {
	loadBuildConfigs,
	loadBuildConfigsAt,
	loadPrimaryBuildConfigAt,
	loadPrimaryBuildConfig,
	loadGroBuildConfigs,
	validateBuildConfigs,
	loadGroPrimaryBuildConfig,
} from './buildConfig.js';

test('loadBuildConfigs()', async () => {
	const c1 = await loadBuildConfigs();
	validateBuildConfigs(c1);
	const c2 = await loadBuildConfigs();
	t.is(c2, c1);
	const c3 = await loadBuildConfigs(true);
	t.isNot(c3, c1);
	t.equal(c3, c1);

	test('loadBuildConfigsAt()', async () => {
		const c4 = await loadBuildConfigsAt(paths.source);
		t.is(c4, c3);
	});

	test('loadPrimaryBuildConfigAt()', async () => {
		const c4 = await loadPrimaryBuildConfigAt(paths.source);
		t.is(c4, c3[0]);
	});

	test('loadPrimaryBuildConfig()', async () => {
		const c4 = await loadPrimaryBuildConfig();
		t.is(c4, c3[0]);
	});

	test('loadGroBuildConfigs()', async () => {
		const c4 = await loadGroBuildConfigs();
		t.is(c4, c3);
	});

	test('loadGroPrimaryBuildConfig()', async () => {
		const c4 = await loadGroPrimaryBuildConfig();
		t.is(c4, c3[0]);
	});
});

test('validateBuildConfigs', () => {
	validateBuildConfigs([{name: 'node', platform: 'node'}]);
	validateBuildConfigs([
		{name: 'node', platform: 'node', dist: true},
		{name: 'node2', platform: 'node', primary: true},
		{name: 'browser', platform: 'browser'},
		{name: 'browser2', platform: 'browser'},
	]);

	test('throws without an array', () => {
		t.throws(() => validateBuildConfigs({name: 'node', platform: 'node'}));
	});

	test('throws without an invalid name', () => {
		t.throws(() => validateBuildConfigs([{platform: 'node'}]));
		t.throws(() => validateBuildConfigs([{name: '', platform: 'node'}]));
	});

	test('throws with duplicate names', () => {
		t.throws(() =>
			validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'node', platform: 'browser'},
			]),
		);
	});

	test('throws with two primary configs ', () => {
		t.throws(() =>
			validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'node2', platform: 'node', primary: true},
				{name: 'node3', platform: 'node', primary: true},
			]),
		);
	});

	test('throws with an invalid platform', () => {
		t.throws(() => validateBuildConfigs([{name: 'node'}]));
		t.throws(() => validateBuildConfigs([{name: 'node', platform: 'deno'}]));
	});
});
