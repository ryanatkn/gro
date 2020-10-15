import {test, t} from '../oki/oki.js';
import {findPrimaryBuildConfig, validateBuildConfigs} from './buildConfig.js';

test('findPrimaryBuildConfig()', async () => {
	test('find explicit primary config', () => {
		const buildConfig = findPrimaryBuildConfig({
			builds: [
				{name: 'node', platform: 'node'},
				{name: 'browser', platform: 'browser', primary: true},
			],
		});
		t.is(buildConfig.name, 'browser');
	});
	test('find implicit primary config and prioritize Node', () => {
		const buildConfig = findPrimaryBuildConfig({
			builds: [
				{name: 'browser', platform: 'browser'},
				{name: 'node1', platform: 'node'},
				{name: 'node2', platform: 'node'},
			],
		});
		t.is(buildConfig.name, 'node1');
	});
	test('find implicit primary config without a Node one', () => {
		const buildConfig = findPrimaryBuildConfig({
			builds: [
				{name: 'browser1', platform: 'browser'},
				{name: 'browser2', platform: 'browser'},
			],
		});
		t.is(buildConfig.name, 'browser1');
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
