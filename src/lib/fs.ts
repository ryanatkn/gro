import { rm} from 'node:fs/promises';
import {readdirSync, type RmOptions} from 'node:fs';
import {join} from 'node:path';

/**
 * Empties a directory with an optional `filter`.
 */
export const empty_dir = async (
	dir: string,
	filter?: (path: string) => boolean,
	options?: RmOptions,
): Promise<void> => {
	await Promise.all(
		(readdirSync(dir)).map((path) =>
			filter && !filter(path) ? null : rm(join(dir, path), {...options, recursive: true}),
		),
	);
};
