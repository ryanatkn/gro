import {Unreachable_Error} from '@feltcoop/felt/util/error.js';

import {to_build_out_path} from '../paths.js';
import type {Builder} from 'src/build/builder.js';

export const noop_builder: Builder = {
	name: '@feltcoop/gro_builder_noop',
	build: (source, build_config, {build_dir, dev}) => {
		const {filename, extension} = source;
		const out_dir = to_build_out_path(dev, build_config.name, source.dir_base_path, build_dir);
		const id = `${out_dir}${filename}`;
		switch (source.encoding) {
			case 'utf8':
				return [
					{
						type: 'build',
						source_id: source.id,
						build_config,
						dependencies_by_build_id: null,
						id,
						filename,
						dir: out_dir,
						extension,
						encoding: source.encoding,
						content: source.content,
						content_buffer: undefined,
						content_hash: undefined,
						stats: undefined,
						mime_type: undefined,
					},
				];
			case null:
				return [
					{
						type: 'build',
						source_id: source.id,
						build_config,
						dependencies_by_build_id: null,
						id,
						filename,
						dir: out_dir,
						extension,
						encoding: source.encoding,
						content: source.content,
						content_buffer: source.content,
						content_hash: undefined,
						stats: undefined,
						mime_type: undefined,
					},
				];
			default:
				throw new Unreachable_Error(source);
		}
	},
	// on_remove: not implemented because it's a no-op
	// init: not implemented because it's a no-op
};
