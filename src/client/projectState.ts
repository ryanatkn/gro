import {setContext, getContext} from 'svelte';
import type {Writable} from 'svelte/store';

import type {ProjectState} from 'src/server/projectState.js';

const contextKey = Symbol();

export const setProjectState = (ctx: Writable<ProjectState>): void =>
	setContext(contextKey, ctx);

export const getProjectState = (): Writable<ProjectState> => getContext(contextKey);
