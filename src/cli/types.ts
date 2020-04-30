export interface Args {
	_: string[];
	[key: string]: string | number | boolean | string[];
}

// this is the same as NodeJS.Process.env but environment-agnostic
export type Env = Obj<string | undefined>;
