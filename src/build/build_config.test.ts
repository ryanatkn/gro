import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {normalize_build_configs, validate_build_configs} from './build_config.js';
import {paths} from '../paths.js';
import {CONFIG_BUILD_CONFIG, SYSTEM_BUILD_CONFIG} from './default_build_config.js';
import {fs} from '../fs/node.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed
const FAKE_CONFIG_INPUT_RAW = 'other_gro.config2.ts';
const FAKE_CONFIG_INPUT_NORMALIZED = [`${paths.source}other_gro.config2.ts`];

/* test_normalize_build_configs */
const test_normalize_build_configs = suite('normalize_build_configs');

test_normalize_build_configs('normalizes a plain config', () => {
	const build_config = normalize_build_configs([
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', platform: 'node', input: '.'},
	]);
	t.equal(build_config, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
	]);
});

test_normalize_build_configs('normalizes inputs', () => {
	const input_path = join(paths.source, 'foo');
	const inputFilter = () => true;
	const build_config = normalize_build_configs([
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', platform: 'node', input: '.'},
		{name: 'node2', platform: 'node', input: paths.source},
		{name: 'node3', platform: 'node', input},
		{name: 'node4', platform: 'node', input: 'foo'},
		{name: 'node5', platform: 'node', input: input_path},
		{name: 'node6', platform: 'node', input: inputFilter},
		{name: 'node7', platform: 'node', input: [input_path, inputFilter]},
	]);
	t.equal(build_config, [
		{name: 'config', platform: 'node', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{
			name: 'node4',
			platform: 'node',
			input: [input_path],
		},
		{
			name: 'node5',
			platform: 'node',
			input: [input_path],
		},
		{
			name: 'node6',
			platform: 'node',
			input: [inputFilter],
		},
		{
			name: 'node7',
			platform: 'node',
			input: [input_path, inputFilter],
		},
	]);
});

test_normalize_build_configs('adds missing config and system configs', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(build_config, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalize_build_configs('adds a missing config build config', () => {
	const build_config = normalize_build_configs([
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(build_config, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalize_build_configs('adds a missing system build config', () => {
	const build_config = normalize_build_configs([
		CONFIG_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(build_config, [
		SYSTEM_BUILD_CONFIG,
		CONFIG_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalize_build_configs('declares a single dist', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
	t.equal(build_config, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
	]);
});

test_normalize_build_configs('ensures a primary config for each platform', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
	t.equal(build_config, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
		{name: 'browser3', platform: 'browser', input},
	]);
});

test_normalize_build_configs('makes all dist when none is', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
	t.equal(build_config, [
		CONFIG_BUILD_CONFIG,
		SYSTEM_BUILD_CONFIG,
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input},
		{name: 'browser2', platform: 'browser', input},
	]);
});

test_normalize_build_configs('throws without an array', () => {
	t.throws(() => normalize_build_configs({name: 'node', platform: 'node'} as any));
});

test_normalize_build_configs.run();
/* /test_normalize_build_configs */

/* test_validate_build_configs */
const test_validate_build_configs = suite('validate_build_configs');

test_validate_build_configs('basic behavior', async () => {
	t.ok((await validate_build_configs(fs, normalize_build_configs([]))).ok);
	t.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([{name: 'node', platform: 'node', input}]),
			)
		).ok,
	);
	t.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', platform: 'node', input},
					{name: 'node2', platform: 'node', input},
					{name: 'browser', platform: 'browser', input},
					{name: 'browser2', platform: 'browser', input},
				]),
			)
		).ok,
	);
	t.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([
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

test_validate_build_configs('fails with input path that does not exist', async () => {
	t.not.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([{name: 'node', platform: 'node', input: 'no_such_file.ts'}]),
			)
		).ok,
	);
});

test_validate_build_configs('fails with undefined', async () => {
	t.not.ok((await validate_build_configs(fs, undefined as any)).ok);
	t.not.ok((await validate_build_configs(fs, {name: 'node', platform: 'node', input} as any)).ok);
});

test_validate_build_configs('fails with an invalid name', async () => {
	t.not.ok(
		(await validate_build_configs(fs, normalize_build_configs([{platform: 'node', input} as any])))
			.ok,
	);
	t.not.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([{name: '', platform: 'node', input}]),
			)
		).ok,
	);
});

test_validate_build_configs('fails with duplicate names', async () => {
	t.ok(
		!(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', platform: 'node', input},
					{name: 'node', platform: 'node', input},
				]),
			)
		).ok,
	);
	t.ok(
		!(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', platform: 'node', input},
					{name: 'node', platform: 'browser', input},
				]),
			)
		).ok,
	);
});

test_validate_build_configs('fails with an invalid platform', async () => {
	t.not.ok(
		(await validate_build_configs(fs, normalize_build_configs([{name: 'node', input} as any]))).ok,
	);
	t.ok(
		!(
			await validate_build_configs(
				fs,
				normalize_build_configs([{name: 'node', platform: 'deno', input} as any]),
			)
		).ok,
	);
});

test_validate_build_configs.run();
/* /test_validate_build_configs */
