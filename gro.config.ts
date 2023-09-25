import type {GroConfig} from './src/lib/config.js';

/**
 * This is the config for the Gro project itself.
 * The default config for dependent projects is located at `./lib/gro.config.default.ts`.
 * The default should be referenced as an example implementation, not this one.
 */
const config: GroConfig = {
	// same as the default, outputs all of `$lib/` as `exports` and the full `.well-known/package.json`
	package_json: (pkg, _when) => pkg,
	// disables both automatic `exports` generation to `package.json` and `.well-known/package.json`
	// package_json: () => null,
	// disable `.well-known/package.json` and enable writing `exports` to `package.json`
	// package_json: (pkg, when) => (when === 'updating_well_known' ? null : pkg),
	// disable writing `exports` to `package.json` and enable `.well-known/package.json`
	// package_json: (pkg, when) => (when === 'updating_exports' ? null : pkg),

	plugins: async () => [
		(await import('./src/lib/gro_plugin_library.js')).plugin(),
		(await import('./src/lib/gro_plugin_sveltekit_frontend.js')).plugin(),
		// TODO replace with an esbuild plugin, see the module for more
		// (await import('./lib/gro_plugin_gen.js')).plugin(),
	],
};

export default config;
