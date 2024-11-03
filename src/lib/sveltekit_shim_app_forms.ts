// shim for $app/forms
// @see https://github.com/sveltejs/kit/issues/1485

import type {
	applyAction as base_applyAction,
	deserialize as base_deserialize,
	enhance as base_enhance,
} from '$app/forms';
import {noop, noop_async} from '@ryanatkn/belt/function.js';
// TODO better way todo this?
// @ts-expect-error
import * as devalue from 'devalue';

export const applyAction: typeof base_applyAction = noop_async;
export const deserialize: typeof base_deserialize = (result) => {
	const parsed = JSON.parse(result);
	if (parsed.data) {
		parsed.data = devalue.parse(parsed.data);
	}
	return parsed;
};
export const enhance: typeof base_enhance = () => ({destroy: noop});
