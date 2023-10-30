import {existsSync} from 'node:fs';

// TODO this was using `access` from `node:fs/promises but there's
// some problem with it and `stat` crashing the process, idk, maybe a quirk of my node version
export const exists = async (path: string): Promise<boolean> => {
	try {
		// await access(path);
		return existsSync(path);
	} catch (err) {
		return false;
	}
};
