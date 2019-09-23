import fs from 'fs-extra';

import {paths} from '../paths.js';

export const clean = async () => {
	await fs.emptyDir(paths.build);
};
