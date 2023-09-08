import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {
	type SerializedSourceMetaData,
	type SourceMetaData,
	serialize_source_meta,
	deserialize_source_meta,
} from './source_meta.js';

/* test__serialize_source_meta */
const test__serialize_source_meta = suite('serialize_source_meta');

test__serialize_source_meta('serializes and deserializes source meta without changes', () => {
	const data: SourceMetaData = {
		source_id: 'a',
		content_hash: 'b',
		builds: [
			{
				id: 'a',
				build_name: 'b',
				dependencies: [
					{
						specifier: 'a',
						mapped_specifier: 'b',
						original_specifier: 'c',
						build_id: 'd',
						external: true,
					},
				],
			},
		],
	};
	assert.equal(serialize_source_meta(data), data);
	assert.equal(deserialize_source_meta(data), data);
});

test__serialize_source_meta('optimizes when serializing', () => {
	const data: SourceMetaData = {
		source_id: 'a',
		content_hash: 'b',
		builds: [
			{
				id: 'a',
				build_name: 'b',
				dependencies: null,
			},
			{
				id: 'a',
				build_name: 'b',
				dependencies: [
					{
						specifier: 'a',
						mapped_specifier: 'a',
						original_specifier: 'a',
						build_id: 'a',
						external: false,
					},
				],
			},
		],
	};
	const serializedData: SerializedSourceMetaData = {
		source_id: 'a',
		content_hash: 'b',
		builds: [
			{id: 'a', build_name: 'b'},
			{id: 'a', build_name: 'b', dependencies: [{specifier: 'a'}]},
		],
	};
	assert.equal(serialize_source_meta(data), serializedData);
	assert.equal(deserialize_source_meta(serializedData), data);
});

test__serialize_source_meta.run();
/* test__serialize_source_meta */
