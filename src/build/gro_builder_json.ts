import {JS_EXTENSION, to_build_out_path} from '../paths.js';
import type {Builder, Text_Build_Source} from 'src/build/builder.js';

export interface Options {
	// optimize: boolean; // TODO implement `JSON.parse(str)`
}

type Json_Builder = Builder<Text_Build_Source>;

export const gro_builder_json = (_options: Options = {}): Json_Builder => {
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
					dependencies_by_build_id: null,
					id: `${out_dir}${filename}${JS_EXTENSION}`,
					filename,
					dir: out_dir,
					extension: JS_EXTENSION,
					encoding: 'utf8',
					content: `export default ${source.content}`,
					content_buffer: undefined,
					content_hash: undefined,
					stats: undefined,
					mime_type: undefined,
				},
			];
		},
	};
};
