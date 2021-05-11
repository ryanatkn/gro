import type {AdaptBuilds} from './adapt.js';
import {hasDeprecatedGroFrontend, hasNodeLibrary} from './defaultBuildConfig.js';

// TODO copy dist ? autodetect behavior?

export const defaultAdapt: AdaptBuilds = async ({fs}) => {
	const [enableGroFrontend, enableNodeLibrary] = await Promise.all([
		// enableApiServer,
		// hasApiServer(fs),
		hasDeprecatedGroFrontend(fs),
		hasNodeLibrary(fs),
	]);
	return [
		// TODO
		// enableApiServer ? (await import('./gro-adapter-api-server.js')).createAdapter() : null,
		enableGroFrontend ? (await import('./gro-adapter-bundled-frontend.js')).createAdapter() : null,
		enableNodeLibrary ? (await import('./gro-adapter-node-library.js')).createAdapter() : null,
	];
};
