import {readable, type Readable} from 'svelte/store';

// see this issue: https://github.com/sveltejs/kit/issues/1485

// $app/environment
export const browser = false;
export const dev = true;
export const prerendering = false;

// $app/paths
export const assets = ''; // TODO read from Svelte config
export const base = ''; // TODO read from Svelte config

// $app/navigation
export const afterNavigate: (callback: (navigation: Navigation) => void) => void = (_cb) => {}; // eslint-disable-line @typescript-eslint/no-empty-function
export const beforeNavigate: (
	callback: (
		navigation: Navigation & {
			cancel: () => void;
		},
	) => void,
) => void = (_cb) => {}; // eslint-disable-line @typescript-eslint/no-empty-function
export const disableScrollHandling: () => void = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function
export const goto = (): Promise<void> => Promise.resolve();
export const invalidate = (_href: string): Promise<object> => Promise.resolve({});
export const invalidateAll = (): Promise<void> => Promise.resolve();
export const prefetch = (_href: string): Promise<object> => Promise.resolve({});
export const prefetchRoutes = (_routes: string[] | undefined): Promise<object> =>
	Promise.resolve({});

// $app/stores
export const navigating = readable(null);
export const page = readable({host: '', path: '', params: new URLSearchParams(), query: {}});
export const updated: Readable<boolean> & {
	check: () => boolean;
} = readable(true) as any;
updated.check = () => true;
export const getStores = () => ({navigating, page, updated} as const);

// TODO currently copypasted from kit to avoid the import dependency
// import type {Navigation} from '@sveltejs/kit';
interface Navigation {
	from: NavigationTarget | null;
	to: NavigationTarget | null;
	type: Omit<NavigationType, 'enter'>;
	willUnload: boolean;
	delta?: number;
}
interface NavigationTarget {
	params: Record<string, string> | null;
	route: {id: string | null};
	url: URL;
}
type NavigationType = 'enter' | 'leave' | 'link' | 'goto' | 'popstate';
