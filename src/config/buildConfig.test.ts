import {test, t} from '../oki/oki.js';
import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';

test('normalizeBuildConfigs()', async () => {
	test('normalizes undefined to a default config', () => {
		const buildConfig = normalizeBuildConfigs(undefined);
		t.equal(buildConfig, [{name: 'node', platform: 'node', primary: true, dist: true}]);
	});
	test('normalizes an empty array to a default config', () => {
		const buildConfig = normalizeBuildConfigs([]);
		t.equal(buildConfig, [{name: 'node', platform: 'node', primary: true, dist: true}]);
	});
	test('normalizes a plain config', () => {
		const buildConfig = normalizeBuildConfigs([{name: 'node', platform: 'node'}]);
		t.equal(buildConfig, [{name: 'node', platform: 'node', primary: true, dist: true}]);
	});
	test('ensures a node config', () => {
		const buildConfig = normalizeBuildConfigs([
			{name: 'browser', platform: 'browser', primary: true},
		]);
		t.equal(buildConfig, [
			{name: 'browser', platform: 'browser', primary: true, dist: true},
			{name: 'node', platform: 'node', primary: true, dist: true},
		]);
	});
	test('ensures a primary config', () => {
		const buildConfig = normalizeBuildConfigs([
			{name: 'node1', platform: 'node', primary: false},
			{name: 'node2', platform: 'node', primary: false},
			{name: 'browser1', platform: 'browser', primary: false},
			{name: 'browser2', platform: 'browser', primary: true},
			{name: 'browser3', platform: 'browser', primary: false, dist: true},
		]);
		t.equal(buildConfig, [
			{name: 'node1', platform: 'node', primary: true, dist: false},
			{name: 'node2', platform: 'node', primary: false, dist: false},
			{name: 'browser1', platform: 'browser', primary: false, dist: false},
			{name: 'browser2', platform: 'browser', primary: true, dist: false},
			{name: 'browser3', platform: 'browser', primary: false, dist: true},
		]);
	});
	test('ensures a dist', () => {
		const buildConfig = normalizeBuildConfigs([{name: 'node', platform: 'node', dist: false}]);
		t.equal(buildConfig, [{name: 'node', platform: 'node', primary: true, dist: true}]);
	});
	test('makes all dist when none is', () => {
		const buildConfig = normalizeBuildConfigs([
			{name: 'node1', platform: 'node', dist: false},
			{name: 'node2', platform: 'node', dist: false},
			{name: 'node3', platform: 'node'},
			{name: 'browser1', platform: 'browser', dist: false},
			{name: 'browser2', platform: 'browser'},
		]);
		t.equal(buildConfig, [
			{name: 'node1', platform: 'node', primary: true, dist: true},
			{name: 'node2', platform: 'node', primary: false, dist: true},
			{name: 'node3', platform: 'node', primary: false, dist: true},
			{name: 'browser1', platform: 'browser', primary: true, dist: true},
			{name: 'browser2', platform: 'browser', primary: false, dist: true},
		]);
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
