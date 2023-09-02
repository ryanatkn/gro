// shim for $app/navigation

import type {
	afterNavigate as base_afterNavigate,
	beforeNavigate as base_beforeNavigate,
	disableScrollHandling as base_disableScrollHandling,
	goto as base_goto,
	invalidate as base_invalidate,
	invalidateAll as base_invalidateAll,
	preloadCode as base_preloadCode,
	preloadData as base_preloadData,
} from '$app/navigation';
import {noop} from '@feltjs/util/function.js';

export const afterNavigate: typeof base_afterNavigate = noop;
export const beforeNavigate: typeof base_beforeNavigate = noop;
export const disableScrollHandling: typeof base_disableScrollHandling = noop;
export const goto: typeof base_goto = () => Promise.resolve();
export const invalidate: typeof base_invalidate = () => Promise.resolve();
export const invalidateAll: typeof base_invalidateAll = () => Promise.resolve();
export const preloadCode: typeof base_preloadCode = () => Promise.resolve();
export const preloadData: typeof base_preloadData = () => Promise.resolve();
