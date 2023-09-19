import type {ParsedSveltekitConfig} from './sveltekit_config.js';

export const sveltekit_shim_app_paths_matcher = /\/util\/sveltekit_shim_app_paths\.js$/u;
export const sveltekit_shim_app_environment_matcher =
	/\/util\/sveltekit_shim_app_environment\.js$/u;

/**
 * Maps SvelteKit `$app` specifiers to their Gro shims.
 * @see https://kit.svelte.dev/docs/modules
 */
export const sveltekit_shim_app_specifiers = new Map([
	['$app/environment', '@feltjs/gro/util/sveltekit_shim_app_environment.js'],
	['$app/forms', '@feltjs/gro/util/sveltekit_shim_app_forms.js'],
	['$app/navigation', '@feltjs/gro/util/sveltekit_shim_app_navigation.js'],
	['$app/paths', '@feltjs/gro/util/sveltekit_shim_app_paths.js'],
	['$app/stores', '@feltjs/gro/util/sveltekit_shim_app_stores.js'],
]);

export const render_sveltekit_shim_app_paths = (
	base_url: ParsedSveltekitConfig['base_url'] = '',
	assets_url: ParsedSveltekitConfig['assets_url'] = '',
): string => `// shim for $app/paths
// @see https://github.com/sveltejs/kit/issues/1485

export const assets = ${JSON.stringify(base_url)};
export const base = ${JSON.stringify(assets_url)};
`;

// TODO improve support
// `dev` is not guaranteed to be the same as `MODE` - https://kit.svelte.dev/docs/modules#$app-environment-dev
// `version` is `config.kit.version.name` but I couldn't see how to load a SvelteKit `ValidatedConfig`
// `building` is just being hardcoded, might be better (but still not correct) to be `!dev`
export const render_sveltekit_shim_app_environment = (
	dev: boolean,
): string => `// shim for $app/environment
// @see https://github.com/sveltejs/kit/issues/1485

export const browser = false;
export const building = false;
export const dev = ${JSON.stringify(dev)};
export const version = 'TODO';
`;
