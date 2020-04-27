import {toBasePath, paths} from '../paths.js';
import {
	ModuleMeta,
	loadModules,
	LoadModulesResult,
	LoadModuleResult,
	loadModule,
} from '../files/loadModules.js';
import {Task, toTaskName, isTaskPath} from './task.js';
import {findFiles} from '../files/nodeFs.js';

export interface TaskModule {
	task: Task;
}

export interface TaskModuleMeta extends ModuleMeta<TaskModule> {
	name: string;
}

export const validateTaskModule = (mod: Obj): mod is TaskModule =>
	!!mod.task && typeof mod.task.run === 'function';

export const loadTaskModule = async (
	id: string,
): Promise<LoadModuleResult<TaskModuleMeta>> => {
	const result = await loadModule(id, validateTaskModule);
	if (!result.ok) return result;
	return {
		...result,
		mod: {...result.mod, name: toTaskName(toBasePath(id))},
	};
};

export const loadTaskModules = (
	inputPaths: string[] = [paths.source],
	extensions: string[] = [],
): Promise<LoadModulesResult<TaskModuleMeta>> =>
	loadModules(
		inputPaths,
		extensions,
		id => findFiles(id, file => isTaskPath(file.path)),
		loadTaskModule,
	);
