import type {AdaptBuilds} from './adapt.js';
import {hasDeprecatedGroFrontend} from './defaultBuildConfig.js';

// TODO copy dist ? autodetect behavior?

export const defaultAdapt: AdaptBuilds = async ({fs}) => {
	const [enableDeprecatedGroFrontend] = await Promise.all([
		// enableApiServer,
		// hasApiServer(fs),
		hasDeprecatedGroFrontend(fs),
	]);
	return [
		enableDeprecatedGroFrontend
			? (await import('./gro-adapter-bundled-frontend.js')).createAdapter()
			: null,
		// TODO
		// (await import('./gro-adapter-node-lib.js')).createAdapter(),
	];
};
