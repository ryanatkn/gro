import {emptyDir} from 'fs-extra';

import {paths} from '../paths.js';

export const clean = async () => {
	await emptyDir(paths.build);
};
