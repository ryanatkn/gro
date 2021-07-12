import {suite} from 'uvu';
import * as t from 'uvu/assert';

import type {Build_Dependency, Serialized_Build_Dependency} from 'src/build/build_dependency.js';
import {serialize_build_dependency, deserialize_build_dependency} from './build_dependency.js';

/* test_serialize_build_dependency */
const test_serialize_build_dependency = suite('serialize_build_dependency');

test_serialize_build_dependency(
	'serializes and deserializes a build dependency without changes',
	() => {
		const dependency: Build_Dependency = {
			specifier: 'a',
			mapped_specifier: 'b',
			original_specifier: 'c',
			build_id: 'd',
			external: true,
		};
		t.equal(serialize_build_dependency(dependency), dependency);
		t.equal(deserialize_build_dependency(dependency), dependency);
	},
);

test_serialize_build_dependency('optimizes when serializing', () => {
	const dependency: Build_Dependency = {
		specifier: 'a',
		mapped_specifier: 'a',
		original_specifier: 'a',
		build_id: 'a',
		external: false,
	};
	const serialized_dependency: Serialized_Build_Dependency = {specifier: 'a'};
	t.equal(serialize_build_dependency(dependency), serialized_dependency);
	t.equal(deserialize_build_dependency(serialized_dependency), dependency);
});

test_serialize_build_dependency.run();
/* /test_serialize_build_dependency */
