import type {BuildConfig} from '../config/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {paths, toBuildOutPath} from '../paths.js';
import type {Logger} from '../utils/log.js';
import {printPath} from '../utils/print.js';
import {printBuildConfig} from '../config/buildConfig.js';
import {isDistFile} from '../project/dist.task.js';

export const copyDist = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
	dev: boolean,
	distCount: number,
	log: Logger,
): Promise<void> => {
	if (!buildConfig.dist) return;
	const buildOutDir = toBuildOutPath(dev, buildConfig.name);
	const distOutDir = distCount === 1 ? paths.dist : `${paths.dist}${printBuildConfig(buildConfig)}`;
	log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
	return fs.copy(buildOutDir, distOutDir, {
		overwrite: false, // prioritize the artifacts from other build processes
		filter: (src) => isDistFile(src),
	});
};
