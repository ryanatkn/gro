// TODO need better name, too much modern stuff conflicting

import {Obj} from './types.js';

// The idea is the it lets you call a bunch of maybe-funtions on some mutable object.

export interface Hook<THookArgs extends any[] = any[]> {
	(...obj: THookArgs): void;
}

export const callHooks = <TObj extends Obj<any>>(
	obj: TObj,
	key: keyof TObj,
	hookArgs: Parameters<TObj[keyof TObj]>,
): void | Promise<unknown[]> => {
	const hooks: Set<Hook> | undefined = obj[key];
	if (!hooks) return;
	return Promise.all(Array.from(hooks).map((hook) => hook(...hookArgs)));
};

export interface RemoveHook {
	(): void;
}

export const addHook = <TObj extends Obj<any>>(
	obj: TObj,
	key: keyof TObj,
	hook: Hook,
): RemoveHook => {
	let hooks: Set<Hook> | undefined = obj[key];
	if (hooks) {
		hooks.add(hook);
	} else {
		(obj as any)[key] = hooks = new Set([hook]);
	}
	return () => {
		hooks!.delete(hook);
	};
};
