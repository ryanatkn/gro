import {resolve} from 'path';

export interface ServedDir {
	dir: string; // TODO rename? `source`, `sourceDir`, `path`
	servedAt: string; // TODO rename?
}

export type ServedDirPartial = string | PartialExcept<ServedDir, 'dir'>;

export const toServedDirs = (
	partials: ServedDirPartial[],
	externalsDir: string | null,
	buildRootDir: string,
): ServedDir[] => {
	const dirs = partials.map((d) => toServedDir(d));
	const uniqueDirs = new Set<string>();
	for (const dir of dirs) {
		// TODO instead of the error, should we allow multiple served paths for each input dir?
		// This is mainly done to prevent duplicate work in watching the source directories.
		if (uniqueDirs.has(dir.dir)) {
			throw Error(`Duplicate servedDirs are not allowed: ${dir.dir}`);
		}
		uniqueDirs.add(dir.dir);
	}
	// Add the externals as a served directory, unless one is already found.
	// This is mostly an ergonomic improvement, and the user can provide a custom one if needed.
	// In the current design, externals should always be served.
	if (externalsDir !== null && !dirs.find((d) => d.dir === externalsDir)) {
		dirs.push(toServedDir({dir: externalsDir, servedAt: buildRootDir}));
	}
	return dirs;
};

export const toServedDir = (dir: ServedDirPartial): ServedDir => {
	if (typeof dir === 'string') dir = {dir};
	const resolvedDir = resolve(dir.dir);
	return {
		dir: resolvedDir,
		servedAt: dir.servedAt ? resolve(dir.servedAt) : resolvedDir,
	};
};
