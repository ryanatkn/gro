import {BuildConfig} from './buildConfig.js';
import {paths} from '../paths.js';

// Gro currently enforces that the primary build config
// for the Node platform has this value as its name.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const DEFAULT_BUILD_CONFIG_NAME = 'node';

export const DEFAULT_BUILD_CONFIG: BuildConfig = {
	name: DEFAULT_BUILD_CONFIG_NAME,
	platform: 'node',
	primary: true,
	dist: false, // gets set to `true` along with all others if none are `true`
	input: [paths.source],
	include: null,
};
