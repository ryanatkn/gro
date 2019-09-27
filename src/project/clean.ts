import fs from 'fs-extra';

import {paths} from '../paths.js';

export const clean = async () => {
	if (fs.existsSync(paths.build)) {
		await fs.emptyDir(paths.build);
	}
	if (fs.existsSync(paths.dist)) {
		await fs.emptyDir(paths.dist);
	}
};
