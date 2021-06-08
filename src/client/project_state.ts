import {setContext, getContext} from 'svelte';
import type {Writable} from 'svelte/store';

import type {Project_State} from '../server/project_state.js';

const context_key = Symbol();

export const provide_project_state = (ctx: Writable<Project_State>): void =>
	setContext(context_key, ctx);

export const use_project_state = (): Writable<Project_State> => getContext(context_key);
