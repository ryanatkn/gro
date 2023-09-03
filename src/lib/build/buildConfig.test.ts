import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';
import {paths} from '../path/paths.js';
import {SYSTEM_BUILD_CONFIG} from './buildConfigDefaults.js';
import {fs} from '../fs/node.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed
const FAKE_CONFIG_INPUT_RAW = 'otherGro.config2.ts';
const FAKE_CONFIG_INPUT_NORMALIZED = [`${paths.source}otherGro.config2.ts`];

/* test__normalizeBuildConfigs */
const test__normalizeBuildConfigs = suite('normalizeBuildConfigs');

test__normalizeBuildConfigs('normalizes a plain config', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'config', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', input: '.'},
	]);
	assert.equal(buildConfig, [
		{name: 'config', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', input},
	]);
});

test__normalizeBuildConfigs('normalizes inputs', () => {
	const inputPath = join(paths.source, 'foo');
	const inputFilter = () => true;
	const buildConfig = normalizeBuildConfigs([
		{name: 'config', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', input: '.'},
		{name: 'node2', input: paths.source},
		{name: 'node3', input},
		{name: 'node4', input: 'foo'},
		{name: 'node5', input: inputPath},
		{name: 'node6', input: inputFilter},
		{name: 'node7', input: [inputPath, inputFilter]},
	]);
	assert.equal(buildConfig, [
		{name: 'config', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', input},
		{name: 'node2', input},
		{name: 'node3', input},
		{name: 'node4', input: [inputPath]},
		{name: 'node5', input: [inputPath]},
		{name: 'node6', input: [inputFilter]},
		{name: 'node7', input: [inputPath, inputFilter]},
	]);
});

test__normalizeBuildConfigs('adds missing system config', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
});

test__normalizeBuildConfigs('declares a single dist', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
});

test__normalizeBuildConfigs('ensures a primary config', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', input},
		{name: 'node2', input},
	]);
	assert.equal(buildConfig, [SYSTEM_BUILD_CONFIG, {name: 'node1', input}, {name: 'node2', input}]);
});

test__normalizeBuildConfigs('makes all dist when none is', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
});

test__normalizeBuildConfigs('throws without an array', () => {
	assert.throws(() => normalizeBuildConfigs({name: 'node'} as any));
});

test__normalizeBuildConfigs.run();
/* test__normalizeBuildConfigs */

/* test__validateBuildConfigs */
const test__validateBuildConfigs = suite('validateBuildConfigs');

test__validateBuildConfigs('basic behavior', async () => {
	assert.ok((await validateBuildConfigs(fs, normalizeBuildConfigs([]))).ok);
	assert.ok((await validateBuildConfigs(fs, normalizeBuildConfigs([{name: 'node', input}]))).ok);
	assert.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', input},
					{name: 'node2', input},
				]),
			)
		).ok,
	);
	assert.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', input},
					{name: 'node2', input},
				]),
			)
		).ok,
	);
});

test__validateBuildConfigs('fails with input path that does not exist', async () => {
	assert.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', input: 'noSuchFile.ts'}]),
			)
		).ok,
	);
});

test__validateBuildConfigs('fails with undefined', async () => {
	assert.ok(!(await validateBuildConfigs(fs, undefined as any)).ok);
	assert.ok(!(await validateBuildConfigs(fs, {name: 'node', input} as any)).ok);
});

test__validateBuildConfigs('fails with an invalid name', async () => {
	assert.ok(!(await validateBuildConfigs(fs, normalizeBuildConfigs([{input} as any]))).ok);
	assert.ok(!(await validateBuildConfigs(fs, normalizeBuildConfigs([{name: '', input}]))).ok);
});

test__validateBuildConfigs('fails with duplicate names', async () => {
	assert.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', input},
					{name: 'node', input},
				]),
			)
		).ok,
	);
});

test__validateBuildConfigs.run();
/* test__validateBuildConfigs */
