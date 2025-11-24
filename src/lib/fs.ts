import {rm, readdir} from 'node:fs/promises';
import {type RmOptions} from 'node:fs';
import {join} from 'node:path';

/**
 * Empties a directory with an optional `filter`.
 */
export const empty_dir = async (
	dir: string,
	filter?: (path: string) => boolean,
	options?: RmOptions,
): Promise<void> => {
	const entries = await readdir(dir);
	await Promise.all(
		entries
			.filter((path) => !filter || filter(path))
			.map((path) => rm(join(dir, path), {...options, recursive: true})),
	);
};
