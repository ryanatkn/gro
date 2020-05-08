import {pathExists, emptyDir} from '../fs/nodeFs.js';
import {paths} from '../paths.js';
import {SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {printPath} from '../utils/print.js';

export const clean = async () => {
	const log = new SystemLogger([magenta('[clean]')]);

	if (await pathExists(paths.build)) {
		log.info('emptying', printPath(paths.build));
		await emptyDir(paths.build);
	}
	if (await pathExists(paths.dist)) {
		log.info('emptying', printPath(paths.dist));
		await emptyDir(paths.dist);
	}
};
