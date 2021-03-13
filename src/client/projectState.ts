import {setContext, getContext} from 'svelte';
import {Writable} from 'svelte/store';

import {ProjectState} from '../server/projectState.js';

const contextKey = Symbol();

export const provideProjectState = (ctx: Writable<ProjectState>): void =>
	setContext(contextKey, ctx);

export const useProjectState = (): Writable<ProjectState> => getContext(contextKey);
