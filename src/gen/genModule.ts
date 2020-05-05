import {ModuleMeta, loadModule, LoadModuleResult} from '../fs/modules.js';
import {Gen} from './gen.js';

export interface GenModule {
	gen: Gen;
}

export interface GenModuleMeta extends ModuleMeta<GenModule> {}

export const validateGenModule = (mod: Obj): mod is GenModule =>
	typeof mod.gen === 'function';

export const loadGenModule = (
	id: string,
): Promise<LoadModuleResult<GenModuleMeta>> =>
	loadModule(id, validateGenModule);
