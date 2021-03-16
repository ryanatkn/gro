import {setContext, getContext} from 'svelte';
import type {Writable} from 'svelte/store';

import type {ProjectState} from '../server/projectState.js';

const contextKey = Symbol();

export const provideProjectState = (ctx: Writable<ProjectState>): void =>
	setContext(contextKey, ctx);

export const useProjectState = (): Writable<ProjectState> => getContext(contextKey);
