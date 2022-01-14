import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {
	serializeBuildDependency,
	deserializeBuildDependency,
	type BuildDependency,
	type SerializedBuildDependency,
} from './buildDependency.js';

/* test__serializeBuildDependency */
const test__serializeBuildDependency = suite('serializeBuildDependency');

test__serializeBuildDependency(
	'serializes and deserializes a build dependency without changes',
	() => {
		const dependency: BuildDependency = {
			specifier: 'a',
			mappedSpecifier: 'b',
			originalSpecifier: 'c',
			buildId: 'd',
			external: true,
		};
		assert.equal(serializeBuildDependency(dependency), dependency);
		assert.equal(deserializeBuildDependency(dependency), dependency);
	},
);

test__serializeBuildDependency('optimizes when serializing', () => {
	const dependency: BuildDependency = {
		specifier: 'a',
		mappedSpecifier: 'a',
		originalSpecifier: 'a',
		buildId: 'a',
		external: false,
	};
	const serializedDependency: SerializedBuildDependency = {specifier: 'a'};
	assert.equal(serializeBuildDependency(dependency), serializedDependency);
	assert.equal(deserializeBuildDependency(serializedDependency), dependency);
});

test__serializeBuildDependency.run();
/* test__serializeBuildDependency */
