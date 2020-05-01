import {toBasePath, paths} from '../paths.js';
import {
	ModuleMeta,
	LoadModuleResult,
	loadModule,
	loadModules,
	findModules,
} from '../files/modules.js';
import {Task, toTaskName, isTaskPath} from './task.js';
import {findFiles} from '../files/nodeFs.js';
import {getPossibleSourceIds} from '../files/inputPaths.js';

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

export const loadTaskModules = async (
	inputPaths: string[] = [paths.source],
	extensions: string[] = [],
	rootDirs: string[] = [],
) => {
	const findModulesResult = await findModules(
		inputPaths,
		id => findFiles(id, file => isTaskPath(file.path)),
		inputPath => getPossibleSourceIds(inputPath, extensions, rootDirs),
	);
	if (!findModulesResult.ok) return findModulesResult;
	return loadModules(findModulesResult.sourceIdsByInputPath, loadTaskModule);
};
