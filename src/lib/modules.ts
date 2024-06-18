import type {Timings} from '@ryanatkn/belt/timings.js';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import type {Result} from '@ryanatkn/belt/result.js';
import {print_error} from '@ryanatkn/belt/print.js';

import {Input_Path} from './input_path.js';
import {print_path} from './paths.js';
import type {Path_Id} from './path.js';

export interface Module_Meta<T_Module extends Record<string, any> = Record<string, any>> {
	id: string;
	mod: T_Module;
}

export type Load_Module_Result<T> = Result<{mod: T}, Load_Module_Failure>;
export type Load_Module_Failure =
	| {ok: false; type: 'failed_import'; id: string; error: Error}
	| {
			ok: false;
			type: 'failed_validation';
			id: string;
			mod: Record<string, any>;
			validation: string;
	  };

export const load_module = async <T extends Record<string, any>>(
	id: string,
	validate?: (mod: Record<string, any>) => mod is T,
): Promise<Load_Module_Result<Module_Meta<T>>> => {
	let mod;
	try {
		mod = await import(id);
	} catch (err) {
		return {ok: false, type: 'failed_import', id, error: err};
	}
	if (validate && !validate(mod)) {
		return {ok: false, type: 'failed_validation', id, mod, validation: validate.name};
	}
	return {ok: true, mod: {id, mod}};
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

// TODO parallelize, originally it needed to be serial for a specific usecase we no longer have
export const load_modules = async <
	Module_Type extends Record<string, any>,
	T_Module_Meta extends Module_Meta<Module_Type>,
>(
	path_ids_by_input_path: Map<Input_Path, Path_Id[]>, // TODO maybe make this a flat array and remove `input_path`?
	load_module_by_id: (path_id: Path_Id) => Promise<Load_Module_Result<T_Module_Meta>>,
	timings?: Timings,
): Promise<Load_Modules_Result<T_Module_Meta>> => {
	const timing_to_load_modules = timings?.start('load modules');
	const modules: T_Module_Meta[] = [];
	const load_module_failures: Load_Module_Failure[] = [];
	const reasons: string[] = [];
	for (const [input_path, path_ids] of path_ids_by_input_path) {
		for (const id of path_ids) {
			const result = await load_module_by_id(id); // eslint-disable-line no-await-in-loop
			if (result.ok) {
				modules.push(result.mod);
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
						// TODO try to make this a good error message for the task case
						reasons.push(`Module ${print_path(id)} failed validation '${result.validation}'.`);
						break;
					}
					default:
						throw new Unreachable_Error(result);
				}
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
