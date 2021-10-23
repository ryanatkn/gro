import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import type {SerializedSourceMetaData, SourceMetaData} from 'src/build/sourceMeta.js';
import {serializeSourceMeta, deserializeSourceMeta} from './sourceMeta.js';

/* testSerializeSourceMeta */
const testSerializeSourceMeta = suite('serializeSourceMeta');

testSerializeSourceMeta('serializes and deserializes source meta without changes', () => {
	const data: SourceMetaData = {
		sourceId: 'a',
		contentHash: 'b',
		builds: [
			{
				id: 'a',
				buildName: 'b',
				dependencies: [
					{
						specifier: 'a',
						mappedSpecifier: 'b',
						originalSpecifier: 'c',
						buildId: 'd',
						external: true,
					},
				],
				encoding: null,
			},
		],
	};
	assert.equal(serializeSourceMeta(data), data);
	assert.equal(deserializeSourceMeta(data), data);
});

testSerializeSourceMeta('optimizes when serializing', () => {
	const data: SourceMetaData = {
		sourceId: 'a',
		contentHash: 'b',
		builds: [
			{
				id: 'a',
				buildName: 'b',
				dependencies: null,
				encoding: 'utf8',
			},
			{
				id: 'a',
				buildName: 'b',
				dependencies: [
					{
						specifier: 'a',
						mappedSpecifier: 'a',
						originalSpecifier: 'a',
						buildId: 'a',
						external: false,
					},
				],
				encoding: 'utf8',
			},
		],
	};
	const serializedData: SerializedSourceMetaData = {
		sourceId: 'a',
		contentHash: 'b',
		builds: [
			{id: 'a', buildName: 'b'},
			{id: 'a', buildName: 'b', dependencies: [{specifier: 'a'}]},
		],
	};
	assert.equal(serializeSourceMeta(data), serializedData);
	assert.equal(deserializeSourceMeta(serializedData), data);
});

testSerializeSourceMeta.run();
/* /testSerializeSourceMeta */
