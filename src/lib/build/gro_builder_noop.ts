import {to_build_out_path} from '../path/paths.js';
import type {Builder} from './builder.js';

export const gro_builder_noop: Builder = {
	name: 'gro_builder_noop',
	build: (source, build_config, {build_dir, dev}) => {
		const {filename, extension} = source;
		const outDir = to_build_out_path(dev, build_config.name, source.dirBasePath, build_dir);
		const id = `${outDir}${filename}`;
		return [
			{
				type: 'build',
				source_id: source.id,
				build_config,
				dependencies: null,
				id,
				filename,
				dir: outDir,
				extension,
				content: source.content,
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
			},
		];
	},
	// on_remove: not implemented because it's a no-op
	// init: not implemented because it's a no-op
};
