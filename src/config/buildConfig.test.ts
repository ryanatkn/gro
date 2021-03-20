import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {join} from 'path';

import {normalizeBuildConfigs, validateBuildConfigs} from './buildConfig.js';
import {paths} from '../paths.js';

const input = [paths.source.substring(0, paths.source.length - 1)]; // TODO fix when trailing slash is removed

/* test_normalizeBuildConfigs */
const test_normalizeBuildConfigs = suite('normalizeBuildConfigs');

test_normalizeBuildConfigs('normalizes a plain config', () => {
	const buildConfig = normalizeBuildConfigs([{name: 'node', platform: 'node', input: '.'}]);
	t.equal(buildConfig, [{name: 'node', platform: 'node', input, primary: true, dist: true}]);
});

test_normalizeBuildConfigs('normalizes inputs', () => {
	const inputPath = join(paths.source, 'foo');
	const inputFilter = () => true;
	const buildConfig = normalizeBuildConfigs([
		{name: 'node', platform: 'node', input: '.'},
		{name: 'node2', platform: 'node', input: paths.source},
		{name: 'node3', platform: 'node', input},
		{name: 'node4', platform: 'node', input: 'foo'},
		{name: 'node5', platform: 'node', input: inputPath},
		{name: 'node6', platform: 'node', input: inputFilter},
		{name: 'node7', platform: 'node', input: [inputPath, inputFilter]},
	]);
	t.equal(buildConfig, [
		{name: 'node', platform: 'node', input, primary: true, dist: true},
		{name: 'node2', platform: 'node', input, primary: false, dist: true},
		{name: 'node3', platform: 'node', input, primary: false, dist: true},
		{
			name: 'node4',
			platform: 'node',
			input: [inputPath],
			primary: false,
			dist: true,
		},
		{
			name: 'node5',
			platform: 'node',
			input: [inputPath],
			primary: false,
			dist: true,
		},
		{
			name: 'node6',
			platform: 'node',
			input: [inputFilter],
			primary: false,
			dist: true,
		},
		{
			name: 'node7',
			platform: 'node',
			input: [inputPath, inputFilter],
			primary: false,
			dist: true,
		},
	]);
});

test_normalizeBuildConfigs('declares a single dist', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input},
		{name: 'node2', platform: 'node', input, dist: true},
		{name: 'node3', platform: 'node', input, primary: true},
	]);
	t.equal(buildConfig, [
		{name: 'node1', platform: 'node', input, primary: false, dist: false},
		{name: 'node2', platform: 'node', input, primary: false, dist: true},
		{name: 'node3', platform: 'node', input, primary: true, dist: false},
	]);
});

test_normalizeBuildConfigs('ensures a primary config for each platform', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input, primary: false, dist: true},
		{name: 'node2', platform: 'node', input, primary: false},
		{name: 'browser1', platform: 'browser', input, primary: false},
		{name: 'browser2', platform: 'browser', input, primary: false},
		{name: 'browser3', platform: 'browser', input, primary: false},
	]);
	t.equal(buildConfig, [
		{name: 'node1', platform: 'node', input, primary: true, dist: true},
		{name: 'node2', platform: 'node', input, primary: false, dist: false},
		{name: 'browser1', platform: 'browser', input, primary: true, dist: false},
		{name: 'browser2', platform: 'browser', input, primary: false, dist: false},
		{name: 'browser3', platform: 'browser', input, primary: false, dist: false},
	]);
});

test_normalizeBuildConfigs('makes all dist when none is', () => {
	const buildConfig = normalizeBuildConfigs([
		{name: 'node1', platform: 'node', input, dist: false},
		{name: 'node2', platform: 'node', input, dist: false},
		{name: 'node3', platform: 'node', input},
		{name: 'browser1', platform: 'browser', input, dist: false},
		{name: 'browser2', platform: 'browser', input},
	]);
	t.equal(buildConfig, [
		{name: 'node1', platform: 'node', input, primary: true, dist: true},
		{name: 'node2', platform: 'node', input, primary: false, dist: true},
		{name: 'node3', platform: 'node', input, primary: false, dist: true},
		{name: 'browser1', platform: 'browser', input, primary: true, dist: true},
		{name: 'browser2', platform: 'browser', input, primary: false, dist: true},
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
				{name: 'node', platform: 'node', input, primary: true},
				{name: 'node2', platform: 'node', input, dist: true},
				{name: 'browser', platform: 'browser', input},
				{name: 'browser2', platform: 'browser', input},
			]),
		).ok,
	);
	t.ok(
		validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node2', platform: 'node', input, dist: true},
				{name: 'browser', platform: 'browser', input},
				{name: 'browser2', platform: 'browser', input, primary: true, dist: true},
				{name: 'browser3', platform: 'browser', input, dist: true},
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

test_validateBuildConfigs(
	'fails with a primary Node name that does not match the enforced default',
	() => {
		t.ok(
			!validateBuildConfigs(
				normalizeBuildConfigs([{name: 'failing_custom_name', platform: 'node', input}]),
			).ok,
		);
		t.ok(
			!validateBuildConfigs(
				normalizeBuildConfigs([
					{name: 'node', platform: 'node', input},
					{name: 'failing_custom_name', platform: 'node', input, primary: true},
				]),
			).ok,
		);
	},
);

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

test_validateBuildConfigs('fails with multiple primary configs for the same platform ', () => {
	t.ok(
		!validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'node2', platform: 'node', input, primary: true},
				{name: 'browser', platform: 'browser', input, primary: true},
				{name: 'node3', platform: 'node', input, primary: true},
			]),
		).ok,
	);
	t.ok(
		!validateBuildConfigs(
			normalizeBuildConfigs([
				{name: 'node', platform: 'node', input},
				{name: 'browser1', platform: 'browser', input, primary: true},
				{name: 'browser2', platform: 'browser', input},
				{name: 'browser3', platform: 'browser', input, primary: true},
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
