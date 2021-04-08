import type {GroConfigCreator, PartialGroConfig} from './config.js';
import {ENV_LOG_LEVEL, LogLevel} from '../utils/log.js';
import {
	hasDeprecatedGroFrontend,
	hasApiServer,
	PRIMARY_NODE_BUILD_CONFIG,
	API_SERVER_BUILD_CONFIG,
	toDefaultBrowserBuild,
} from './defaultBuildConfig.js';

// This is the default config that's used if the current project does not define one.
// The default config detects
// Gro's deprecated SPA mode - https://github.com/feltcoop/gro/issues/106 -
// if it sees both a `src/index.html` and `src/index.ts`.
// It also looks for a primary Node server entry point at `src/server/server.ts`.
// Both are no-ops if not detected.

export const config: GroConfigCreator = async () => {
	const partial: PartialGroConfig = {
		builds: [
			PRIMARY_NODE_BUILD_CONFIG,
			(await hasApiServer()) ? API_SERVER_BUILD_CONFIG : null,
			(await hasDeprecatedGroFrontend()) ? toDefaultBrowserBuild() : null, // TODO configure asset paths
		],
		logLevel: ENV_LOG_LEVEL ?? LogLevel.Trace,
	};
	return partial;
};
