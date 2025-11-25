import type {PathId} from '@ryanatkn/belt/path.js';

// TODO extract more here from Filer

export interface Disknode {
	id: PathId;
	// TODO figure out the best API that makes this lazy
	/**
	 * `null` contents means it doesn't exist.
	 * We create the file in memory to track its dependents regardless of its existence on disk.
	 */
	contents: string | null;
	/**
	 * Is the source file outside of the `root_dir` or excluded by `watch_dir_options.filter`?
	 */
	external: boolean;
	ctime: number | null;
	mtime: number | null;
	dependents: Map<PathId, Disknode>;
	dependencies: Map<PathId, Disknode>;
}
