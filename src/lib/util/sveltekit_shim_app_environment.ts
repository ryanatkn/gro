// shim for $app/environment
// see this issue: https://github.com/sveltejs/kit/issues/1485

import {DEV, BROWSER} from 'esm-env';

export const browser = BROWSER;
export const dev = DEV;
export const building = false;
export const version = '';
