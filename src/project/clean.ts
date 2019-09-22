import {emptyDir} from 'fs-extra';

import {paths} from '../paths';

export const clean = async () => {
	await emptyDir(paths.build);
};
