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
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', platform: 'node', input: '.'},
	]);
	assert.equal(buildConfig, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
	]);
});

test__normalizeBuildConfigs('normalizes inputs', () => {
	const inputPath = join(paths.source, 'foo');
	const inputFilter = () => true;
	const buildConfig = normalizeBuildConfigs([
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', platform: 'node', input: '.'},
		{name: 'node2', platform: 'node', input: paths.source},
		{name: 'node3', platform: 'node', input},
		{name: 'node4', platform: 'node', input: 'foo'},
		{name: 'node5', platform: 'node', input: inputPath},
		{name: 'node6', platform: 'node', input: inputFilter},
		{name: 'node7', platform: 'node', input: [inputPath, inputFilter]},
	]);
	assert.equal(buildConfig, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'node4', platform: 'node', input: [inputPath]},
		{name: 'node5', platform: 'node', input: [inputPath]},
		{name: 'node6', platform: 'node', input: [inputFilter]},
		{name: 'node7', platform: 'node', input: [inputPath, inputFilter]},
	]);
});

test__normalizeBuildConfigs('adds missing system config', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test__normalizeBuildConfigs('declares a single dist', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test__normalizeBuildConfigs('ensures a primary config for each platform', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
});

test__normalizeBuildConfigs('makes all dist when none is', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
	assert.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
});

test__normalizeBuildConfigs('throws without an array', () => {
	assert.throws(() => normalizeBuildConfigs({name: 'node', platform: 'node'} as any));
});

test__normalizeBuildConfigs.run();
/* test__normalizeBuildConfigs */

/* test__validateBuildConfigs */
const test__validateBuildConfigs = suite('validateBuildConfigs');

test__validateBuildConfigs('basic behavior', async () => {
	assert.ok((await validateBuildConfigs(fs, normalizeBuildConfigs([]))).ok);
	assert.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', platform: 'node', input}]),
			)
		).ok,
	);
	assert.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', platform: 'node', input},
					{name: 'node2', platform: 'node', input},
					{name: 'browser', platform: 'browser', input},
					{name: 'browser2', platform: 'browser', input},
				]),
			)
		).ok,
	);
	assert.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', platform: 'node', input},
					{name: 'node2', platform: 'node', input},
					{name: 'browser', platform: 'browser', input},
					{name: 'browser2', platform: 'browser', input},
					{name: 'browser3', platform: 'browser', input},
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
				normalizeBuildConfigs([{name: 'node', platform: 'node', input: 'noSuchFile.ts'}]),
			)
		).ok,
	);
});

test__validateBuildConfigs('fails with undefined', async () => {
	assert.ok(!(await validateBuildConfigs(fs, undefined as any)).ok);
	assert.ok(!(await validateBuildConfigs(fs, {name: 'node', platform: 'node', input} as any)).ok);
});

test__validateBuildConfigs('fails with an invalid name', async () => {
	assert.ok(
		!(await validateBuildConfigs(fs, normalizeBuildConfigs([{platform: 'node', input} as any]))).ok,
	);
	assert.ok(
		!(await validateBuildConfigs(fs, normalizeBuildConfigs([{name: '', platform: 'node', input}])))
			.ok,
	);
});

test__validateBuildConfigs('fails with duplicate names', async () => {
	assert.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', platform: 'node', input},
					{name: 'node', platform: 'node', input},
				]),
			)
		).ok,
	);
	assert.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([
					{name: 'node', platform: 'node', input},
					{name: 'node', platform: 'browser', input},
				]),
			)
		).ok,
	);
});

test__validateBuildConfigs('fails with an invalid platform', async () => {
	assert.ok(
		!(await validateBuildConfigs(fs, normalizeBuildConfigs([{name: 'node', input} as any]))).ok,
	);
	assert.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', platform: 'deno', input} as any]),
			)
		).ok,
	);
});

test__validateBuildConfigs.run();
/* test__validateBuildConfigs */
