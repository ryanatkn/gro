import type {BuildConfig, InputFilter} from '../config/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIRNAME,
	toBuildBasePath,
	toBuildOutPath,
	toSourceExtension,
} from '../paths.js';
import type {Logger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import {isTestBuildFile, isTestBuildArtifact} from '../fs/testModule.js';
import {isInputToBuildConfig} from './utils.js';

export const copyDist = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
	dev: boolean,
	distOutDir: string,
	log: Logger,
	filters?: InputFilter[], // TODO this is hacky, should be `buildConfig.input` but we're using it to branch logic
): Promise<void> => {
	const buildOutDir = toBuildOutPath(dev, buildConfig.name);
	const externalsDir = toBuildOutPath(dev, buildConfig.name, EXTERNALS_BUILD_DIRNAME);
	log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
	return fs.copy(buildOutDir, distOutDir, {
		overwrite: false, // prioritize the artifacts from other build processes
		filter: async (src) => {
			if (src === externalsDir) return false;
			const stats = await fs.stat(src);
			if (stats.isDirectory()) return true;
			if (!isDistFile(src)) return false; // TODO refactor this out
			if (!filters) return true;
			const sourceId = basePathToSourceId(toBuildBasePath(toSourceExtension(src)));
			return isInputToBuildConfig(sourceId, filters);
		},
	});
};

export const isDistFile = (path: string): boolean =>
	!isTestBuildFile(path) && !isTestBuildArtifact(path);
