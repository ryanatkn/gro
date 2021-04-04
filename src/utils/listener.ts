// TODO need better name, too much modern stuff conflicting

import {Obj} from './types.js';

export interface Listener<TListenerArgs extends any[] = any[]> {
	(...obj: TListenerArgs): void;
}

export const callListeners = <TObj extends Obj<any>>(
	obj: TObj,
	key: keyof TObj,
	listenerArgs: Parameters<TObj[keyof TObj]>,
): void | Promise<unknown[]> => {
	const listeners: Set<Listener> | undefined = obj[key];
	if (!listeners) return;
	return Promise.all(Array.from(listeners).map((listener) => listener(...listenerArgs)));
};

export interface RemoveListener {
	(): void;
}

export const addListener = <TObj extends Obj<any>>(
	obj: TObj,
	key: keyof TObj,
	listener: Listener,
): RemoveListener => {
	let listeners: Set<Listener> | undefined = obj[key];
	if (listeners) {
		listeners.add(listener);
	} else {
		(obj as any)[key] = listeners = new Set([listener]);
	}
	return () => {
		listeners!.delete(listener);
	};
};
