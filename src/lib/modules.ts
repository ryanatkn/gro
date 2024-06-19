import type {Timings} from '@ryanatkn/belt/timings.js';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {print_error} from '@ryanatkn/belt/print.js';

import type {Resolved_Input_File} from './input_path.js';
import {print_path} from './paths.js';
import type {Path_Id} from './path.js';

export interface Module_Meta<T_Module extends Record<string, any> = Record<string, any>> {
	id: Path_Id;
	mod: T_Module;
}

export type Load_Module_Result<T_Module> = Result<
	{id: Path_Id; mod: T_Module},
	Load_Module_Failure
>;
export type Load_Module_Failure =
	| {ok: false; type: 'failed_import'; id: Path_Id; error: Error}
	| {
			ok: false;
			type: 'failed_validation';
			id: Path_Id;
			mod: Record<string, any>;
			validation: string;
	  };

export const load_module = async <T_Module extends Record<string, any>>(
	id: Path_Id,
	validate?: (mod: Record<string, any>) => mod is T_Module,
): Promise<Load_Module_Result<T_Module>> => {
	let mod;
	try {
		mod = await import(id);
	} catch (err) {
		return {ok: false, type: 'failed_import', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'failed_validation', id, mod, validation: validate.name};
	}
	return {ok: true, id, mod};
};

export type Load_Modules_Result<T_Module_Meta extends Module_Meta> = Result<
	{
		modules: T_Module_Meta[];
	},
	{
		type: 'load_module_failures';
		load_module_failures: Load_Module_Failure[];
		reasons: string[];
		// still return the modules and timings, deferring to the caller
		modules: T_Module_Meta[];
	}
>;

// TODO parallelize and sort afterwards
export const load_modules = async <
	T_Module extends Record<string, any>,
	T_Module_Meta extends Module_Meta<T_Module>,
>(
	resolved_input_files: Resolved_Input_File[],
	validate: (mod: any) => mod is T_Module,
	map_module_meta: (id: Path_Id, mod: T_Module) => T_Module_Meta,
	timings?: Timings,
): Promise<Load_Modules_Result<T_Module_Meta>> => {
	const timing_to_load_modules = timings?.start('load modules');
	const modules: T_Module_Meta[] = [];
	const load_module_failures: Load_Module_Failure[] = [];
	const reasons: string[] = [];
	for (const input_path_data of resolved_input_files.values()) {
		const {id, input_path} = input_path_data;
		const result = await load_module(id, validate); // eslint-disable-line no-await-in-loop
		if (result.ok) {
			modules.push(map_module_meta(id, result.mod));
		} else {
			load_module_failures.push(result);
			switch (result.type) {
				case 'failed_import': {
					reasons.push(
						`Module import ${print_path(id)} failed from input ${print_path(
							input_path,
						)}: ${print_error(result.error)}`,
					);
					break;
				}
				case 'failed_validation': {
					reasons.push(`Module ${print_path(id)} failed validation '${result.validation}'.`);
					break;
				}
				default:
					throw new Unreachable_Error(result);
			}
		}
	}
	timing_to_load_modules?.();

	if (load_module_failures.length) {
		return {
			ok: false,
			type: 'load_module_failures',
			load_module_failures,
			reasons,
			modules,
		};
	}

	return {ok: true, modules};
};
