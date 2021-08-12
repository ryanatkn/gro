import {setContext, getContext} from 'svelte';
import type {Writable} from 'svelte/store';

import type {ProjectState} from 'src/server/project_state.js';

const context_key = Symbol();

export const set_project_state = (ctx: Writable<ProjectState>): void =>
	setContext(context_key, ctx);

export const get_project_state = (): Writable<ProjectState> => getContext(context_key);
