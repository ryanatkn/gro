import {JS_EXTENSION, toBuildOutPath} from '../paths.js';
import type {Builder, TextBuildSource} from 'src/build/builder.js';

export interface Options {
	optimize?: boolean; // see `toJsonJsContent` below
}

type JsonBuilder = Builder<TextBuildSource>;

export const groBuilderJson = (options: Options = {}): JsonBuilder => {
	const {optimize = true} = options;
	return {
		name: '@feltcoop/groBuilderJson',
		build: (source, buildConfig, {buildDir, dev}) => {
			const {filename} = source;
			const outDir = toBuildOutPath(dev, buildConfig.name, source.dirBasePath, buildDir);
			return [
				{
					type: 'build',
					sourceId: source.id,
					buildConfig,
					dependencies: null,
					id: `${outDir}${filename}${JS_EXTENSION}`,
					filename,
					dir: outDir,
					extension: JS_EXTENSION,
					encoding: 'utf8',
					content: toJsonJsContent(source.content, optimize),
					contentBuffer: undefined,
					contentHash: undefined,
					stats: undefined,
					mimeType: undefined,
				},
			];
		},
	};
};

// Optimization described here:
// https://v8.dev/blog/cost-of-javascript-2019#json
// https://v8.dev/features/subsume-json#embedding-json-parse
const toJsonJsContent = (content: string, optimize: boolean): string =>
	optimize ? `export default JSON.parse(${JSON.stringify(content)})` : `export default ${content}`;
