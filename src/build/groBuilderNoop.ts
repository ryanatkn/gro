import {UnreachableError} from '@feltcoop/util/error.js';

import {toBuildOutPath} from '../paths.js';
import type {Builder} from './builder.js';

export const groBuilderNoop: Builder = {
	name: '@feltjs/groBuilderNoop',
	build: (source, buildConfig, {buildDir, dev}) => {
		const {filename, extension} = source;
		const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
		const id = `${outDir}${filename}`;
		switch (source.encoding) {
			case 'utf8':
				return [
					{
						type: 'build',
						sourceId: source.id,
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
						sourceId: source.id,
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
