import fs from 'fs-extra';

import {paths} from '../paths.js';
import {SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {fmtPath} from '../utils/fmt.js';

export const clean = async () => {
	const log = new SystemLogger([magenta('[clean]')]);
	const {info} = log;

	if (fs.existsSync(paths.build)) {
		info('emptying', fmtPath(paths.build));
		await fs.emptyDir(paths.build);
	}
	if (fs.existsSync(paths.dist)) {
		info('emptying', fmtPath(paths.dist));
		await fs.emptyDir(paths.dist);
	}
};
