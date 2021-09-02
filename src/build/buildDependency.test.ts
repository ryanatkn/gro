import {suite} from 'uvu';
import * as t from 'uvu/assert';

import type {BuildDependency, SerializedBuildDependency} from 'src/build/buildDependency.js';
import {serializeBuildDependency, deserializeBuildDependency} from './buildDependency.js';

/* testSerializeBuildDependency */
const testSerializeBuildDependency = suite('serializeBuildDependency');

testSerializeBuildDependency(
	'serializes and deserializes a build dependency without changes',
	() => {
		const dependency: BuildDependency = {
			specifier: 'a',
			mappedSpecifier: 'b',
			originalSpecifier: 'c',
			buildId: 'd',
			external: true,
		};
		t.equal(serializeBuildDependency(dependency), dependency);
		t.equal(deserializeBuildDependency(dependency), dependency);
	},
);

testSerializeBuildDependency('optimizes when serializing', () => {
	const dependency: BuildDependency = {
		specifier: 'a',
		mappedSpecifier: 'a',
		originalSpecifier: 'a',
		buildId: 'a',
		external: false,
	};
	const serializedDependency: SerializedBuildDependency = {specifier: 'a'};
	t.equal(serializeBuildDependency(dependency), serializedDependency);
	t.equal(deserializeBuildDependency(serializedDependency), dependency);
});

testSerializeBuildDependency.run();
/* /testSerializeBuildDependency */
