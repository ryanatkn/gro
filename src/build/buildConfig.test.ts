import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';
import {paths} from '../paths.js';
import {CONFIG_BUILD_CONFIG, SYSTEM_BUILD_CONFIG} from './defaultBuildConfig.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed
const FAKE_CONFIG_INPUT_RAW = 'other_gro.config2.ts';
const FAKE_CONFIG_INPUT_NORMALIZED = [`${paths.source}other_gro.config2.ts`];

/* test_normalizeBuildConfigs */
const test_normalizeBuildConfigs = suite('normalizeBuildConfigs');

test_normalizeBuildConfigs('normalizes a plain config', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', platform: 'node', input: '.'},
	]);
	t.equal(buildConfig, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
	]);
});

test_normalizeBuildConfigs('normalizes inputs', () => {
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

test_normalizeBuildConfigs('adds missing config and system configs', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(buildConfig, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalizeBuildConfigs('adds a missing config build config', () => {
	const buildConfig = normalizeBuildConfigs([
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(buildConfig, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalizeBuildConfigs('adds a missing system build config', () => {
	const buildConfig = normalizeBuildConfigs([
		CONFIG_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(buildConfig, [
		SYSTEM_BUILD_CONFIG,
		CONFIG_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalizeBuildConfigs('declares a single dist', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(buildConfig, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalizeBuildConfigs('ensures a primary config for each platform', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
	t.equal(buildConfig, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
});

test_normalizeBuildConfigs('makes all dist when none is', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
	t.equal(buildConfig, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
});

test_normalizeBuildConfigs('throws without an array', () => {
	t.throws(() => normalizeBuildConfigs({name: 'node', platform: 'node'} as any));
});

test_normalizeBuildConfigs.run();
/* /test_normalizeBuildConfigs */

/* test_validateBuildConfigs */
const test_validateBuildConfigs = suite('validateBuildConfigs');

test_validateBuildConfigs('basic behavior', () => {
	t.ok(validateBuildConfigs(normalizeBuildConfigs([{name: 'node', platform: 'node', input}])).ok);
	t.ok(
		validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node2', platform: 'node', input},
				{name: 'browser', platform: 'browser', input},
				{name: 'browser2', platform: 'browser', input},
			]),
		).ok,
	);
	t.ok(
		validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node2', platform: 'node', input},
				{name: 'browser', platform: 'browser', input},
				{name: 'browser2', platform: 'browser', input},
				{name: 'browser3', platform: 'browser', input},
			]),
		).ok,
	);
});

test_validateBuildConfigs('fails with undefined', () => {
	t.not.ok(validateBuildConfigs(undefined as any).ok);
	t.not.ok(validateBuildConfigs({name: 'node', platform: 'node', input} as any).ok);
});

test_validateBuildConfigs('fails with an invalid name', () => {
	t.not.ok(validateBuildConfigs(normalizeBuildConfigs([{platform: 'node', input} as any])).ok);
	t.not.ok(validateBuildConfigs(normalizeBuildConfigs([{name: '', platform: 'node', input}])).ok);
});

test_validateBuildConfigs('fails with duplicate names', () => {
	t.ok(
		!validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node', platform: 'node', input},
			]),
		).ok,
	);
	t.ok(
		!validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node', platform: 'browser', input},
			]),
		).ok,
	);
});

test_validateBuildConfigs('fails with an invalid platform', () => {
	t.not.ok(validateBuildConfigs(normalizeBuildConfigs([{name: 'node', input} as any])).ok);
	t.ok(
		!validateBuildConfigs(normalizeBuildConfigs([{name: 'node', platform: 'deno', input} as any]))
			.ok,
	);
});

test_validateBuildConfigs.run();
/* /test_validateBuildConfigs */
