import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';
import {paths} from '../paths.js';
import {CONFIG_BUILD_CONFIG, SYSTEM_BUILD_CONFIG} from './buildConfigDefaults.js';
import {fs} from '../fs/node.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed
const FAKE_CONFIG_INPUT_RAW = 'otherGro.config2.ts';
const FAKE_CONFIG_INPUT_NORMALIZED = [`${paths.source}otherGro.config2.ts`];

/* testNormalizeBuildConfigs */
const testNormalizeBuildConfigs = suite('normalizeBuildConfigs');

testNormalizeBuildConfigs('normalizes a plain config', () => {
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
			{name: 'system', platform: 'node', input: '.'},
		],
		true,
	);
	t.equal(buildConfig, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
	]);
});

testNormalizeBuildConfigs('normalizes inputs', () => {
	const inputPath = join(paths.source, 'foo');
	const inputFilter = () => true;
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
			{name: 'system', platform: 'node', input: '.'},
			{name: 'node2', platform: 'node', input: paths.source},
			{name: 'node3', platform: 'node', input},
			{name: 'node4', platform: 'node', input: 'foo'},
			{name: 'node5', platform: 'node', input: inputPath},
			{name: 'node6', platform: 'node', input: inputFilter},
			{name: 'node7', platform: 'node', input: [inputPath, inputFilter]},
		],
		true,
	);
	t.equal(buildConfig, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{
			name: 'node4',
			platform: 'node',
			input: [inputPath],
		},
		{
			name: 'node5',
			platform: 'node',
			input: [inputPath],
		},
		{
			name: 'node6',
			platform: 'node',
			input: [inputFilter],
		},
		{
			name: 'node7',
			platform: 'node',
			input: [inputPath, inputFilter],
		},
	]);
});

testNormalizeBuildConfigs('adds missing system config', () => {
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'node1', platform: 'node', input},
			{name: 'node2', platform: 'node', input},
			{name: 'node3', platform: 'node', input},
		],
		true,
	);
	t.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

testNormalizeBuildConfigs('declares a single dist', () => {
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'node1', platform: 'node', input},
			{name: 'node2', platform: 'node', input},
			{name: 'node3', platform: 'node', input},
		],
		true,
	);
	t.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

testNormalizeBuildConfigs('ensures a primary config for each platform', () => {
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'node1', platform: 'node', input},
			{name: 'node2', platform: 'node', input},
			{name: 'browser1', platform: 'browser', input},
			{name: 'browser2', platform: 'browser', input},
			{name: 'browser3', platform: 'browser', input},
		],
		true,
	);
	t.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
});

testNormalizeBuildConfigs('makes all dist when none is', () => {
	const buildConfig = normalizeBuildConfigs(
		[
			{name: 'node1', platform: 'node', input},
			{name: 'node2', platform: 'node', input},
			{name: 'node3', platform: 'node', input},
			{name: 'browser1', platform: 'browser', input},
			{name: 'browser2', platform: 'browser', input},
		],
		true,
	);
	t.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
});

testNormalizeBuildConfigs('throws without an array', () => {
	t.throws(() => normalizeBuildConfigs({name: 'node', platform: 'node'} as any, true));
});

testNormalizeBuildConfigs.run();
/* /testNormalizeBuildConfigs */

/* testValidateBuildConfigs */
const testValidateBuildConfigs = suite('validateBuildConfigs');

testValidateBuildConfigs('basic behavior', async () => {
	t.ok((await validateBuildConfigs(fs, normalizeBuildConfigs([], true), true)).ok);
	t.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', platform: 'node', input}], true),
				true,
			)
		).ok,
	);
	t.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs(
					[
						{name: 'node', platform: 'node', input},
						{name: 'node2', platform: 'node', input},
						{name: 'browser', platform: 'browser', input},
						{name: 'browser2', platform: 'browser', input},
					],
					true,
				),
				true,
			)
		).ok,
	);
	t.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs(
					[
						{name: 'node', platform: 'node', input},
						{name: 'node2', platform: 'node', input},
						{name: 'browser', platform: 'browser', input},
						{name: 'browser2', platform: 'browser', input},
						{name: 'browser3', platform: 'browser', input},
					],
					true,
				),
				true,
			)
		).ok,
	);
});

testValidateBuildConfigs('fails with input path that does not exist', async () => {
	t.not.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', platform: 'node', input: 'noSuchFile.ts'}], true),
				true,
			)
		).ok,
	);
});

testValidateBuildConfigs('fails with undefined', async () => {
	t.not.ok((await validateBuildConfigs(fs, undefined as any, true)).ok);
	t.not.ok(
		(await validateBuildConfigs(fs, {name: 'node', platform: 'node', input} as any, true)).ok,
	);
});

testValidateBuildConfigs('fails with an invalid name', async () => {
	t.not.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{platform: 'node', input} as any], true),
				true,
			)
		).ok,
	);
	t.not.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: '', platform: 'node', input}], true),
				true,
			)
		).ok,
	);
});

testValidateBuildConfigs('fails with duplicate names', async () => {
	t.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs(
					[
						{name: 'node', platform: 'node', input},
						{name: 'node', platform: 'node', input},
					],
					true,
				),
				true,
			)
		).ok,
	);
	t.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs(
					[
						{name: 'node', platform: 'node', input},
						{name: 'node', platform: 'browser', input},
					],
					true,
				),
				true,
			)
		).ok,
	);
});

testValidateBuildConfigs('fails with a config build in production mode', async () => {
	t.not.ok((await validateBuildConfigs(fs, [CONFIG_BUILD_CONFIG], false)).ok);
});

testValidateBuildConfigs('fails with a system build in production mode', async () => {
	t.not.ok((await validateBuildConfigs(fs, [SYSTEM_BUILD_CONFIG], false)).ok);
});

testValidateBuildConfigs('fails with an invalid platform', async () => {
	t.not.ok(
		(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', input} as any], true),
				true,
			)
		).ok,
	);
	t.ok(
		!(
			await validateBuildConfigs(
				fs,
				normalizeBuildConfigs([{name: 'node', platform: 'deno', input} as any], true),
				true,
			)
		).ok,
	);
});

testValidateBuildConfigs.run();
/* /testValidateBuildConfigs */
