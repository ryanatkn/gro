/**
 * Maps SvelteKit `$app` specifiers to their Gro shims.
 * @see https://kit.svelte.dev/docs/modules
 */
export const to_sveltekit_app_specifier = (specifier: string): string | null =>
	shimmed_specifiers.has(specifier) ? shimmed_specifiers.get(specifier)! : null;

const shimmed_specifiers = new Map([
	['$app/environment', '@feltjs/gro/util/sveltekit_shim_app_environment.js'],
	['$app/forms', '@feltjs/gro/util/sveltekit_shim_app_forms.js'],
	['$app/navigation', '@feltjs/gro/util/sveltekit_shim_app_navigation.js'],
	['$app/paths', '@feltjs/gro/util/sveltekit_shim_app_paths.js'],
	['$app/stores', '@feltjs/gro/util/sveltekit_shim_app_stores.js'],
]);
