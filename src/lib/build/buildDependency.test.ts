import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {
	serialize_build_dependency,
	deserialize_build_dependency,
	type BuildDependency,
	type SerializedBuildDependency,
} from './buildDependency.js';

/* test__serialize_build_dependency */
const test__serialize_build_dependency = suite('serialize_build_dependency');

test__serialize_build_dependency(
	'serializes and deserializes a build dependency without changes',
	() => {
		const dependency: BuildDependency = {
			specifier: 'a',
			mapped_specifier: 'b',
			original_specifier: 'c',
			build_id: 'd',
			external: true,
		};
		assert.equal(serialize_build_dependency(dependency), dependency);
		assert.equal(deserialize_build_dependency(dependency), dependency);
	},
);

test__serialize_build_dependency('optimizes when serializing', () => {
	const dependency: BuildDependency = {
		specifier: 'a',
		mapped_specifier: 'a',
		original_specifier: 'a',
		build_id: 'a',
		external: false,
	};
	const serializedDependency: SerializedBuildDependency = {specifier: 'a'};
	assert.equal(serialize_build_dependency(dependency), serializedDependency);
	assert.equal(deserialize_build_dependency(serializedDependency), dependency);
});

test__serialize_build_dependency.run();
/* test__serialize_build_dependency */
