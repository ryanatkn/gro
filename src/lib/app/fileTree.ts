import {toPathSegments} from '@feltcoop/felt/util/pathParsing.js';
import {stripStart} from '@feltcoop/felt/util/string.js';
import {basename} from 'path-browserify';

import type {SourceTreeMeta} from '$lib/app/sourceTree';

export type FileTreeNode = FileTreeFile | FileTreeFolder;

export interface FileTreeFile {
	type: 'file';
	name: string;
	meta: SourceTreeMeta;
}

export interface FileTreeFolder {
	type: 'folder';
	name: string;
	children: FileTreeNode[];
}

// TODO instead of reconstructing the dirs/files here,
// probably push this upstream - filer dirs are probably the prereq

// TODO refactor all of this, some hacky code because data structures aren't final

export const toFileTreeFolder = (
	sourceDir: string,
	sourceTreeMetas: SourceTreeMeta[],
): FileTreeFolder => {
	const root: FileTreeFolder = {type: 'folder', name: basename(sourceDir), children: []};
	const getFileInfo = (basePath: string): {folder: FileTreeFolder; name: string} => {
		let current: FileTreeFolder = root;
		const segments = toPathSegments(basePath);
		// The `sourceTreeMetas` currently include files only and not directories,
		// so we just ignore the final segment, and assume everything else is a folder.
		for (const segment of segments.slice(0, segments.length - 1)) {
			let next = current.children.find((t) => t.name === segment) as FileTreeFolder | undefined;
			if (!next) {
				next = {type: 'folder', name: segment, children: []};
				current.children.push(next);
			}
			current = next;
		}
		return {folder: current, name: segments[segments.length - 1]};
	};
	for (const meta of sourceTreeMetas) {
		const sourceIdBasePath = stripStart(meta.data.sourceId, sourceDir);
		const {folder, name} = getFileInfo(sourceIdBasePath);
		folder.children.push({type: 'file', name, meta});
	}
	forEachFolder(root, (f) => sortFolderChildren(f));
	return root;
};

const forEachFolder = (folder: FileTreeFolder, cb: (folder: FileTreeFolder) => void) => {
	cb(folder);
	for (const child of folder.children) {
		if (child.type === 'folder') {
			forEachFolder(child, cb);
		}
	}
};

// sorts `folder.children` in place, putting files after directories
const sortFolderChildren = (folder: FileTreeFolder): void => {
	folder.children.sort((a, b) => {
		if (a.type === 'folder') {
			if (b.type !== 'folder') return -1;
		} else if (b.type === 'folder') return 1;
		return a.name.localeCompare(b.name);
	});
};
