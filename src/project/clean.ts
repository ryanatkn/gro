import fs from 'fs-extra';
const {existsSync, emptyDir} = fs; // TODO esm

import {paths} from '../paths.js';
import {SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {fmtPath} from '../utils/fmt.js';

export const clean = async () => {
	const log = new SystemLogger([magenta('[clean]')]);
	const {info} = log;

	if (existsSync(paths.build)) {
		info('emptying', fmtPath(paths.build));
		await emptyDir(paths.build);
	}
	if (existsSync(paths.dist)) {
		info('emptying', fmtPath(paths.dist));
		await emptyDir(paths.dist);
	}
};
