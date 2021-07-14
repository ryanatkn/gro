import {JS_EXTENSION, to_build_out_path} from '../paths.js';
import type {Builder, Text_Build_Source} from 'src/build/builder.js';

export interface Options {
	optimize?: boolean; // see `to_json_js_content` below
}

type Json_Builder = Builder<Text_Build_Source>;

export const gro_builder_json = (options: Options = {}): Json_Builder => {
	const {optimize = true} = options;
	return {
		name: '@feltcoop/gro_builder_json',
		build: (source, build_config, {build_dir, dev}) => {
			const {filename} = source;
			const out_dir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
			return [
				{
					type: 'build',
					source_id: source.id,
					build_config,
					dependencies: null,
					id: `${out_dir}${filename}${JS_EXTENSION}`,
					filename,
					dir: out_dir,
					extension: JS_EXTENSION,
					encoding: 'utf8',
					content: to_json_js_content(source.content, optimize),
					content_buffer: undefined,
					content_hash: undefined,
					stats: undefined,
					mime_type: undefined,
				},
			];
		},
	};
};

// Optimization described here:
// https://v8.dev/blog/cost-of-javascript-2019#json
// https://v8.dev/features/subsume-json#embedding-json-parse
const to_json_js_content = (content: string, optimize: boolean): string =>
	optimize ? `export default JSON.parse(${JSON.stringify(content)})` : `export default ${content}`;
