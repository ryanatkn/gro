import {SourceTreeMeta} from './sourceTree.js';
import {toPathSegments} from '../utils/path.js';
import {stripStart} from '../utils/string.js';

export type FileTreeNode = FileTreeFile | FileTreeFolder;

export interface FileTreeFile {
	type: 'file';
	name: string;
}

export interface FileTreeFolder {
	type: 'folder';
	name: string;
	children: FileTreeNode[];
}

// TODO instead of reconstructing the dirs/files here,
// probably push this upstream - filer dirs are probably the prereq

// TODO refactor all of this, some hacky code because data structures aren't final

export const toFileTree = (
	sourceDir: string,
	sourceTreeMetas: SourceTreeMeta[],
	rootDirName: string,
): FileTreeFolder => {
	const fileTree: FileTreeFolder = {type: 'folder', name: rootDirName, children: []};
	const getFileInfo = (basePath: string): {folder: FileTreeFolder; name: string} => {
		let current: FileTreeFolder = fileTree;
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
	for (const sourceTreeMeta of sourceTreeMetas) {
		const sourceIdBasePath = stripStart(sourceTreeMeta.data.sourceId, sourceDir);
		const {folder, name} = getFileInfo(sourceIdBasePath);
		folder.children.push({type: 'file', name});
	}
	return fileTree;
};
