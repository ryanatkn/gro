import {access, constants, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {RmOptions} from 'node:fs';

export const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch (err) {
		if (err.code === 'ENOENT') return false;
		throw err;
	}
};

/**
 * Empties a directory with an optional `filter`.
 */
export const empty_dir = async (
	dir: string,
	filter?: (path: string) => boolean,
	options?: RmOptions,
): Promise<void> => {
	await Promise.all(
		(await readdir(dir)).map((path) =>
			filter && !filter(path) ? null : rm(join(dir, path), {...options, recursive: true}),
		),
	);
};
