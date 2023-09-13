// shim for $app/environment
// @see https://github.com/sveltejs/kit/issues/1485

export const browser = false;
export const dev = true; // TODO BLOCK - esm-env? make 2 versions of this module?
export const building = false; // TODO BLOCK source from SvelteKit somehow?
export const version = '';
