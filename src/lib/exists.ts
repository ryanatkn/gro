import {access, constants} from 'node:fs/promises';

export const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch (err) {
		if (err.code === 'ENOENT') return false;
		throw err;
	}
};
