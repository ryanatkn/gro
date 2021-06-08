import {basename} from 'path';
import {to_path_segments} from '@feltcoop/felt/utils/path.js';
import {strip_start} from '@feltcoop/felt/utils/string.js';

import type {Source_Tree_Meta} from './source_tree.js';

export type File_Tree_Node = File_Tree_File | File_Tree_Folder;

export interface File_Tree_File {
	type: 'file';
	name: string;
	meta: Source_Tree_Meta;
}

export interface File_Tree_Folder {
	type: 'folder';
	name: string;
	children: File_Tree_Node[];
}

// TODO instead of reconstructing the dirs/files here,
// probably push this upstream - filer dirs are probably the prereq

// TODO refactor all of this, some hacky code because data structures aren't final

export const to_file_tree_folder = (
	source_dir: string,
	source_treeMetas: Source_Tree_Meta[],
): File_Tree_Folder => {
	const root: File_Tree_Folder = {type: 'folder', name: basename(source_dir), children: []};
	const getFileInfo = (base_path: string): {folder: File_Tree_Folder; name: string} => {
		let current: File_Tree_Folder = root;
		const segments = to_path_segments(base_path);
		// The `source_treeMetas` currently include files only and not directories,
		// so we just ignore the final segment, and assume everything else is a folder.
		for (const segment of segments.slice(0, segments.length - 1)) {
			let next = current.children.find((t) => t.name === segment) as File_Tree_Folder | undefined;
			if (!next) {
				next = {type: 'folder', name: segment, children: []};
				current.children.push(next);
			}
			current = next;
		}
		return {folder: current, name: segments[segments.length - 1]};
	};
	for (const meta of source_treeMetas) {
		const source_idBasePath = strip_start(meta.data.source_id, source_dir);
		const {folder, name} = getFileInfo(source_idBasePath);
		folder.children.push({type: 'file', name, meta});
	}
	forEachFolder(root, (f) => sortFolderChildren(f));
	return root;
};

const forEachFolder = (folder: File_Tree_Folder, cb: (folder: File_Tree_Folder) => void) => {
	cb(folder);
	for (const child of folder.children) {
		if (child.type === 'folder') {
			forEachFolder(child, cb);
		}
	}
};

// sorts `folder.children` in place, putting files after directories
const sortFolderChildren = (folder: File_Tree_Folder): void => {
	folder.children.sort((a, b) => {
		if (a.type === 'folder') {
			if (b.type !== 'folder') return -1;
		} else if (b.type === 'folder') return 1;
		return a.name.localeCompare(b.name);
	});
};
