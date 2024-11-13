// shim for $app/forms
// @see https://github.com/sveltejs/kit/issues/1485

import type {
	applyAction as base_applyAction,
	deserialize as base_deserialize,
	enhance as base_enhance,
} from '$app/forms';
import {noop, noop_async} from '@ryanatkn/belt/function.js';

export const applyAction: typeof base_applyAction = noop_async;
export const deserialize: typeof base_deserialize = () => ({}) as any;
export const enhance: typeof base_enhance = () => ({destroy: noop});
