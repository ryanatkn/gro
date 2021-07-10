import {suite} from 'uvu';
import * as t from 'uvu/assert';

import type {Serialized_Source_Meta_Data, Source_Meta_Data} from './source_meta.js';
import {serialize_source_meta, deserialize_source_meta} from './source_meta.js';

/* test_serialize_source_meta */
const test_serialize_source_meta = suite('serialize_source_meta');

test_serialize_source_meta('serializes and deserializes source meta without changes', () => {
	const data: Source_Meta_Data = {
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
				encoding: null,
			},
		],
	};
	t.equal(serialize_source_meta(data), data);
	t.equal(deserialize_source_meta(data), data);
});

test_serialize_source_meta('optimizes when serializing', () => {
	const data: Source_Meta_Data = {
		source_id: 'a',
		content_hash: 'b',
		builds: [
			{
				id: 'a',
				build_name: 'b',
				dependencies: null,
				encoding: 'utf8',
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
				encoding: 'utf8',
			},
		],
	};
	const serialized_data: Serialized_Source_Meta_Data = {
		source_id: 'a',
		content_hash: 'b',
		builds: [
			{id: 'a', build_name: 'b'},
			{id: 'a', build_name: 'b', dependencies: [{specifier: 'a'}]},
		],
	};
	t.equal(serialize_source_meta(data), serialized_data);
	t.equal(deserialize_source_meta(serialized_data), data);
});

test_serialize_source_meta.run();
/* /test_serialize_source_meta */
