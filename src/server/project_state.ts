import type {Source_Meta} from '../build/source_meta.js';
import type {Build_Config} from '../build/build_config.js';
import type {Package_Json} from '../utils/package_json.js';

// TODO rename?
// Project_State (current)
// ProjectMeta
// Source_Meta
// ..?

// TODO should these properties be split into things that are static and dynamic?
// `items` is dynamic but most of these aren't

// TODO currently serving this at `src/` - how should the code/types be organized?
export interface Project_State {
	// TODO this is a hacky, not using the filer's dirs for the source,
	// but that's because it doesn't have a single one, so..?
	// it's similar to the "// TODO refactor" above - `src/` is hardcoded in.
	// The client needs it for now but it needs to be rethought.
	readonly build_dir: string; // TODO see above
	readonly source_dir: string; // TODO see above
	readonly items: Source_Meta[];
	readonly build_configs: readonly Build_Config[];
	// TODO should this be imported/replaced at buildtime instead of loading/sending like thie?
	readonly package_json: Package_Json;
}
