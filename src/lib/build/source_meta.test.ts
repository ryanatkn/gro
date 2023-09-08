import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {
	type SerializedSourceMetaData,
	type SourceMetaData,
	serializeSourceMeta,
	deserializeSourceMeta,
} from './source_meta.js';

/* test__serializeSourceMeta */
const test__serializeSourceMeta = suite('serializeSourceMeta');

test__serializeSourceMeta('serializes and deserializes source meta without changes', () => {
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
	assert.equal(serializeSourceMeta(data), data);
	assert.equal(deserializeSourceMeta(data), data);
});

test__serializeSourceMeta('optimizes when serializing', () => {
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
	assert.equal(serializeSourceMeta(data), serializedData);
	assert.equal(deserializeSourceMeta(serializedData), data);
});

test__serializeSourceMeta.run();
/* test__serializeSourceMeta */
