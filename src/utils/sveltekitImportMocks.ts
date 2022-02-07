import {readable, writable} from 'svelte/store';

// see this issue: https://github.com/sveltejs/kit/issues/1485

export const amp = false;
export const browser = false;
export const dev = true;
export const mode = 'development';
export const prerendering = false;

export const assets = ''; // TODO read from Svelte config
export const base = ''; // TODO read from Svelte config

export const goto = (): Promise<void> => Promise.resolve();
export const invalidate = (_href: string): Promise<object> => Promise.resolve({});
export const prefetch = (_href: string): Promise<object> => Promise.resolve({});
export const prefetchRoutes = (_routes: string[] | undefined): Promise<object> =>
	Promise.resolve({});

export const navigating = readable(null);
export const page = readable({host: '', path: '', params: new URLSearchParams(), query: {}});
export const session = writable({});
export const getStores = () => ({navigating, page, session} as const);
