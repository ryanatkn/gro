import {extname, basename} from 'path';

export const replaceExtension = (path: string, newExtension: string): string => {
	const {length} = extname(path);
	return (length === 0 ? path : path.substring(0, path.length - length)) + newExtension;
};

// Gets the stem of a path, the "b" of "/a/b.c".
export const toPathStem = (path: string): string => replaceExtension(basename(path), '');

// Designed for the `cheap-watch` API.
// toPathParts('./foo/bar/baz.ts') => ['foo', 'foo/bar', 'foo/bar/baz.ts']
export const toPathParts = (path: string): string[] => {
	const segments = toPathSegments(path);
	let currentPath = path[0] === '/' ? '/' : '';
	return segments.map((segment) => {
		if (!currentPath || currentPath === '/') {
			currentPath += segment;
		} else {
			currentPath += '/' + segment;
		}
		return currentPath;
	});
};

// Gets the individual parts of a path, ignoring dots and separators.
// toPathSegments('/foo/bar/baz.ts') => ['foo', 'bar', 'baz.ts']
export const toPathSegments = (path: string): string[] =>
	path.split('/').filter((s) => s && s !== '.');
