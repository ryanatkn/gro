import type {AdaptBuilds} from './adapter.js';
import {
	hasDeprecatedGroFrontend,
	hasNodeLibrary,
	hasSvelteKitFrontend,
} from '../build/defaultBuildConfig.js';

export const defaultAdapt: AdaptBuilds = async ({fs}) => {
	const [enableNodeLibrary, enableGroFrontend, enableSvelteKitFrontend] = await Promise.all([
		// enableApiServer,
		// hasApiServer(fs),
		hasNodeLibrary(fs),
		hasDeprecatedGroFrontend(fs),
		hasSvelteKitFrontend(fs),
	]);
	return [
		// TODO
		// enableApiServer ? (await import('./gro-adapter-api-server.js')).createAdapter() : null,
		enableNodeLibrary ? (await import('./gro-adapter-node-library.js')).createAdapter() : null,
		enableGroFrontend
			? (await import('./gro-adapter-spa-frontend.js')).createAdapter({builds: ['browser']})
			: null,
		enableSvelteKitFrontend
			? (await import('./gro-adapter-sveltekit-frontend.js')).createAdapter()
			: null,
	];
};
