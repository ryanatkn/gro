import type {Obj} from '../types.js';

export interface Args {
	_: string[];
	[key: string]: string | number | boolean | string[] | undefined;
}

// this is the same as NodeJS.Process.env but environment-agnostic
export type Env = Obj<string | undefined>;
