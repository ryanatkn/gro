import {type SourceMeta} from '../build/sourceMeta.js';
import {type BuildConfig} from '../build/buildConfig.js';
import {type PackageJson} from '../utils/packageJson.js';

// TODO rename?
// ProjectState (current)
// ProjectMeta
// SourceMeta
// ..?

// TODO should these properties be split into things that are static and dynamic?
// `items` is dynamic but most of these aren't

// TODO currently serving this at `src/` - how should the code/types be organized?
export interface ProjectState {
	// TODO this is a hacky, not using the filer's dirs for the source,
	// but that's because it doesn't have a single one, so..?
	// it's similar to the "// TODO refactor" above - `src/` is hardcoded in.
	// The client needs it for now but it needs to be rethought.
	readonly buildDir: string; // TODO see above
	readonly sourceDir: string; // TODO see above
	readonly items: SourceMeta[];
	readonly buildConfigs: readonly BuildConfig[];
	// TODO should this be imported/replaced at buildtime instead of loading/sending like thie?
	readonly packageJson: PackageJson;
}
