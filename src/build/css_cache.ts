import {green} from '@feltcoop/felt/util/terminal.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import {print_key_value} from '@feltcoop/felt/util/print.js';

import {print_path} from '../paths.js';

export interface Css_Build {
	id: string;
	code: string | null;
}

export type Css_Bundle<T extends Css_Build = Css_Build> = {
	bundle_name: string;
	builds_by_id: Map<string, T>;
	changed_ids: Set<string>;
};

export interface CssCache<T extends Css_Build = Css_Build> {
	get_css_bundles(): Map<string, Css_Bundle<T>>;
	get_css_build(bundle_name: string, id: string): T;
	add_css_build(bundle_name: string, build: T): boolean;
}

export const create_css_cache = <T extends Css_Build = Css_Build>(): CssCache<T> => {
	const log = new System_Logger(print_log_label('cssCache', green));

	// `bundles` key is an output bundle file name
	const bundles = new Map<string, Css_Bundle<T>>();

	return {
		get_css_bundles: () => bundles,
		get_css_build: (bundle_name, id) => {
			const bundle = bundles.get(bundle_name);
			if (!bundle) {
				throw Error(`Expected to find CSS bundle name '${bundle_name}'`);
			}
			const css_build = bundle.builds_by_id.get(id);
			if (!css_build) {
				throw Error(`Expected to find CSS build with id '${id}' for '${bundle_name}'`);
			}
			return css_build;
		},
		add_css_build: (bundle_name, build) => {
			const {id} = build;
			let bundle = bundles.get(bundle_name);
			if (bundle) {
				const cached_build = bundle.builds_by_id.get(id);
				if (build.code === (cached_build && cached_build.code)) {
					// build didn't change
					return false;
				}
			} else {
				bundle = {bundle_name, builds_by_id: new Map(), changed_ids: new Set()};
				bundles.set(bundle_name, bundle);
			}

			log.info(print_key_value('caching', print_path(id)), print_key_value('bundle', bundle_name));
			bundle.builds_by_id.set(id, build);
			bundle.changed_ids.add(id);

			// build changed
			return true;
		},
	};
};
