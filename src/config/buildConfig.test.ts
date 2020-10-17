import {test, t} from '../oki/oki.js';
import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';

test('normalizeBuildConfigs()', async () => {
	test('find explicit primary config', () => {
		const buildConfig = normalizeBuildConfigs(undefined);
		// t.is(buildConfig.name, 'browser');
	});
});

test('validateBuildConfigs', () => {
	validateBuildConfigs(undefined);
	validateBuildConfigs([{name: 'node', platform: 'node'}]);
	validateBuildConfigs([
		{name: 'node', platform: 'node', dist: true},
		{name: 'node2', platform: 'node', primary: true},
		{name: 'browser', platform: 'browser'},
		{name: 'browser2', platform: 'browser'},
	]);
	validateBuildConfigs([
		{name: 'node', platform: 'node'},
		{name: 'node2', platform: 'node', primary: true},
		{name: 'browser', platform: 'browser'},
		{name: 'browser2', platform: 'browser', primary: true},
	]);

	test('fails without an array', () => {
		t.ok(!validateBuildConfigs({name: 'node', platform: 'node'} as any).ok);
	});

	test('fails with an invalid name', () => {
		t.ok(!validateBuildConfigs([{platform: 'node'} as any]).ok);
		t.ok(!validateBuildConfigs([{name: '', platform: 'node'}]).ok);
	});

	test('fails with duplicate names', () => {
		t.ok(
			!validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'node', platform: 'node'},
			]).ok,
		);
		t.ok(
			!validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'node', platform: 'browser'},
			]).ok,
		);
	});

	test('fails with multiple primary configs for the same platform ', () => {
		t.ok(
			!validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'node2', platform: 'node', primary: true},
				{name: 'browser', platform: 'browser', primary: true},
				{name: 'node3', platform: 'node', primary: true},
			]).ok,
		);
		t.ok(
			!validateBuildConfigs([
				{name: 'node', platform: 'node'},
				{name: 'browser1', platform: 'browser', primary: true},
				{name: 'browser2', platform: 'browser'},
				{name: 'browser3', platform: 'browser', primary: true},
			]).ok,
		);
	});

	test('fails with an invalid platform', () => {
		t.ok(!validateBuildConfigs([{name: 'node'} as any]).ok);
		t.ok(!validateBuildConfigs([{name: 'node', platform: 'deno'} as any]).ok);
	});
});
