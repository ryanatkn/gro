import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {join} from 'node:path';

import {normalize_build_configs, validate_build_configs} from './build_config.js';
import {paths} from '../path/paths.js';
import {fs} from '../fs/node.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed
const FAKE_CONFIG_INPUT_RAW = 'otherGro.config2.ts';
const FAKE_CONFIG_INPUT_NORMALIZED = [`${paths.source}otherGro.config2.ts`];

/* test__normalize_build_configs */
const test__normalize_build_configs = suite('normalize_build_configs');

test__normalize_build_configs('normalizes a plain config', () => {
	const build_config = normalize_build_configs([
		{name: 'config', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', input: '.'},
	]);
	assert.equal(build_config, [
		{name: 'config', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', input},
	]);
});

test__normalize_build_configs('normalizes inputs', () => {
	const input_path = join(paths.source, 'foo');
	const filter = () => true;
	const build_config = normalize_build_configs([
		{name: 'config', input: FAKE_CONFIG_INPUT_RAW},
		{name: 'system', input: '.'},
		{name: 'node2', input: paths.source},
		{name: 'node3', input},
		{name: 'node4', input: 'foo'},
		{name: 'node5', input: input_path},
		{name: 'node6', input: filter},
		{name: 'node7', input: [input_path, filter]},
	]);
	assert.equal(build_config, [
		{name: 'config', input: FAKE_CONFIG_INPUT_NORMALIZED},
		{name: 'system', input},
		{name: 'node2', input},
		{name: 'node3', input},
		{name: 'node4', input: [input_path]},
		{name: 'node5', input: [input_path]},
		{name: 'node6', input: [filter]},
		{name: 'node7', input: [input_path, filter]},
	]);
});

test__normalize_build_configs('declares a single dist', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
	assert.equal(build_config, [
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
});

test__normalize_build_configs('ensures a primary config', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', input},
		{name: 'node2', input},
	]);
	assert.equal(build_config, [
		{name: 'node1', input},
		{name: 'node2', input},
	]);
});

test__normalize_build_configs('makes all dist when none is', () => {
	const build_config = normalize_build_configs([
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
	assert.equal(build_config, [
		{name: 'node1', input},
		{name: 'node2', input},
		{name: 'node3', input},
	]);
});

test__normalize_build_configs('throws without an array', () => {
	assert.throws(() => normalize_build_configs({name: 'node'} as any));
});

test__normalize_build_configs.run();
/* test__normalize_build_configs */

/* test__validate_build_configs */
const test__validate_build_configs = suite('validate_build_configs');

test__validate_build_configs('basic behavior', async () => {
	assert.ok((await validate_build_configs(fs, normalize_build_configs([]))).ok);
	assert.ok(
		(await validate_build_configs(fs, normalize_build_configs([{name: 'node', input}]))).ok,
	);
	assert.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', input},
					{name: 'node2', input},
				]),
			)
		).ok,
	);
	assert.ok(
		(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', input},
					{name: 'node2', input},
				]),
			)
		).ok,
	);
});

test__validate_build_configs('fails with input path that does not exist', async () => {
	assert.ok(
		!(
			await validate_build_configs(
				fs,
				normalize_build_configs([{name: 'node', input: 'noSuchFile.ts'}]),
			)
		).ok,
	);
});

test__validate_build_configs('fails with undefined', async () => {
	assert.ok(!(await validate_build_configs(fs, undefined as any)).ok);
	assert.ok(!(await validate_build_configs(fs, {name: 'node', input} as any)).ok);
});

test__validate_build_configs('fails with an invalid name', async () => {
	assert.ok(!(await validate_build_configs(fs, normalize_build_configs([{input} as any]))).ok);
	assert.ok(!(await validate_build_configs(fs, normalize_build_configs([{name: '', input}]))).ok);
});

test__validate_build_configs('fails with duplicate names', async () => {
	assert.ok(
		!(
			await validate_build_configs(
				fs,
				normalize_build_configs([
					{name: 'node', input},
					{name: 'node', input},
				]),
			)
		).ok,
	);
});

test__validate_build_configs.run();
/* test__validate_build_configs */
