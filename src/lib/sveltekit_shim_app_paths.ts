// shim for $app/paths
// @see https://github.com/sveltejs/kit/issues/1485

/**
 * This file is created dynamically by `render_sveltekit_shim_app_paths`
 * but exists here for the sake of the Node loader.
 * There may be a cleaner workaround but I couldn't find it.
 * @see https://github.com/nodejs/loaders for details about the forthcoming virtual file support
 */

import type {resolve as base_resolve, resolveRoute as base_resolveRoute} from '$app/paths';
import {noop} from '@ryanatkn/belt/function.js';

export const assets = '';
/** @deprecated */
export const base = '';
export const resolve: typeof base_resolve = (v) => ('/' + v.replace(/^\//, '')) as any; // TODO needs to use SvelteKit config base, should we just import it?
/** @deprecated */
export const resolveRoute: typeof base_resolveRoute = noop;
