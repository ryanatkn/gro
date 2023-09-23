import {access} from 'node:fs/promises';

export const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch (err) {
		return false;
	}
};
