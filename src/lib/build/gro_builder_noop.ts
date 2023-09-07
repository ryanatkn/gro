import {UnreachableError} from '@feltjs/util/error.js';

import {to_build_out_path} from '../path/paths.js';
import type {Builder} from './builder.js';

export const gro_builder_noop: Builder = {
	name: 'gro_builder_noop',
	build: (source, buildConfig, {build_dir, dev}) => {
		const {filename, extension} = source;
		const outDir = to_build_out_path(dev, buildConfig.name, source.dirBasePath, build_dir);
		const id = `${outDir}${filename}`;
		switch (source.encoding) {
			case 'utf8':
				return [
					{
						type: 'build',
						source_id: source.id,
						buildConfig,
						dependencies: null,
						id,
						filename,
						dir: outDir,
						extension,
						encoding: source.encoding,
						content: source.content,
						contentBuffer: undefined,
						contentHash: undefined,
						stats: undefined,
						mimeType: undefined,
					},
				];
			case null:
				return [
					{
						type: 'build',
						source_id: source.id,
						buildConfig,
						dependencies: null,
						id,
						filename,
						dir: outDir,
						extension,
						encoding: source.encoding,
						content: source.content,
						contentBuffer: source.content,
						contentHash: undefined,
						stats: undefined,
						mimeType: undefined,
					},
				];
			default:
				throw new UnreachableError(source);
		}
	},
	// onRemove: not implemented because it's a no-op
	// init: not implemented because it's a no-op
};
