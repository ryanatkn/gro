import type {Plugin} from 'rollup';
import {dirname, join, relative} from 'path';
import sourcemap_codec from 'sourcemap-codec';
import {blue, gray} from '@feltcoop/felt/util/terminal.js';
import {System_Logger, print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';

import type {Filesystem} from '../fs/filesystem.js';
import type {Gro_Css_Build, Gro_Css_Bundle} from './gro_css_build.js';

export interface Options {
	fs: Filesystem;
	get_css_bundles(): Map<string, Gro_Css_Bundle>;
	to_final_css?: (build: Gro_Css_Build, log: Logger) => string | null;
	sourcemap?: boolean;
}

export const name = '@feltcoop/rollup_plugin_gro_output_css';

export const rollup_plugin_gro_output_css = (options: Options): Plugin => {
	const {fs, get_css_bundles, to_final_css = default_to_final_css, sourcemap = false} = options;

	const log = new System_Logger(print_log_label(name, blue));

	return {
		name,
		async generateBundle(output_options, _bundle, isWrite) {
			if (!isWrite) return;

			log.info('generateBundle');

			// TODO chunks!
			const output_dir = output_options.dir || dirname(output_options.file!);

			// write each changed bundle to disk
			for (const bundle of get_css_bundles().values()) {
				const {bundle_name, builds_by_id, changed_ids} = bundle;
				if (!changed_ids.size) {
					log.trace(`no changes detected, skipping bundle ${gray(bundle_name)}`);
					continue;
				}

				// TODO try to avoid doing work for the sourcemap and `to_final_css` by caching stuff that hasn't changed
				log.info('generating css bundle', blue(bundle_name));
				log.info('changes', Array.from(changed_ids)); // TODO trace when !watch
				changed_ids.clear();

				const mappings: sourcemap_codec.SourceMapSegment[][] = [];
				const sources: string[] = [];
				const sources_content: string[] = [];

				// sort the css builds for determinism and so the cascade works according to import order
				const builds = Array.from(builds_by_id.values()).sort((a, b) =>
					a.sort_index === b.sort_index
						? a.id > b.id
							? 1
							: -1
						: a.sort_index > b.sort_index
						? 1
						: -1,
				);

				// create the final css and sourcemap
				let css_strings: string[] = [];
				for (const build of builds) {
					const code = to_final_css(build, log);
					if (!code) continue;
					css_strings.push(code);

					// add css sourcemap to later merge
					// TODO avoid work if there's a single sourcemap
					// TODO do we we ever want a warning/error if `build.map` is undefined?
					if (sourcemap && build.map && build.map.sourcesContent) {
						const sources_length = sources.length;
						sources.push(build.map.sources[0]);
						sources_content.push(build.map.sourcesContent[0]);
						const decoded = sourcemap_codec.decode(build.map.mappings);
						if (sources_length > 0) {
							for (const line of decoded) {
								for (const segment of line) {
									segment[1] = sources_length;
								}
							}
						}
						mappings.push(...decoded);
					}
				}
				const css = css_strings.join('\n');

				const dest = join(output_dir, bundle_name);

				if (sources.length) {
					const sourcemap_dest = dest + '.map';
					const final_css = css + `\n/*# sourceMappingURL=${bundle_name}.map */\n`;
					const css_sourcemap = JSON.stringify(
						{
							version: 3,
							file: bundle_name,
							sources: sources.map((s) => relative(output_dir, s)),
							sources_content,
							names: [],
							mappings: sourcemap_codec.encode(mappings),
						},
						null,
						2,
					);
					log.info('writing css bundle and sourcemap', dest);
					await Promise.all([
						fs.write_file(dest, final_css),
						fs.write_file(sourcemap_dest, css_sourcemap),
					]);
				} else {
					log.info('writing css bundle', dest);
					await fs.write_file(dest, css);
				}
			}
		},
	};
};

const default_to_final_css = ({code}: Gro_Css_Build, _log: Logger): string | null => code;
