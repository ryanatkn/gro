import type {Task_Context} from '../task/task.js';
import type {Gro_Config} from '../config/config.js';

export interface Plugin<T_Args = any, T_Events = any> {
	name: string;
	// summary: string; // TODO?
	// TODO rename these?
	dev_setup: () => (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
	dev_teardown: () => (ctx: Plugin_Context<T_Args, T_Events>) => void | Promise<void>;
}

export interface To_Config_Plugins<T_Args = any, T_Events = any> {
	(ctx: Plugin_Context<T_Args, T_Events>):
		| (Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[])
		| Promise<Plugin<T_Args, T_Events> | null | (Plugin<T_Args, T_Events> | null)[]>;
}

export interface Plugin_Context<T_Args = any, T_Events = any>
	extends Task_Context<T_Args, T_Events> {
	config: Gro_Config;
}
