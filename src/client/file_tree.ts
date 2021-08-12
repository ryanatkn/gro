import {basename} from 'path';
import {to_path_segments} from '@feltcoop/felt/util/path_parsing.js';
import {strip_start} from '@feltcoop/felt/util/string.js';

import type {SourceTreeMeta} from 'src/client/source_tree.js';

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

export const to_file_tree_folder = (
	source_dir: string,
	source_tree_metas: SourceTreeMeta[],
): FileTreeFolder => {
	const root: FileTreeFolder = {type: 'folder', name: basename(source_dir), children: []};
	const get_file_info = (base_path: string): {folder: FileTreeFolder; name: string} => {
		let current: FileTreeFolder = root;
		const segments = to_path_segments(base_path);
		// The `source_tree_metas` currently include files only and not directories,
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
	for (const meta of source_tree_metas) {
		const source_id_base_path = strip_start(meta.data.source_id, source_dir);
		const {folder, name} = get_file_info(source_id_base_path);
		folder.children.push({type: 'file', name, meta});
	}
	for_each_folder(root, (f) => sort_folder_children(f));
	return root;
};

const for_each_folder = (folder: FileTreeFolder, cb: (folder: FileTreeFolder) => void) => {
	cb(folder);
	for (const child of folder.children) {
		if (child.type === 'folder') {
			for_each_folder(child, cb);
		}
	}
};

// sorts `folder.children` in place, putting files after directories
const sort_folder_children = (folder: FileTreeFolder): void => {
	folder.children.sort((a, b) => {
		if (a.type === 'folder') {
			if (b.type !== 'folder') return -1;
		} else if (b.type === 'folder') return 1;
		return a.name.localeCompare(b.name);
	});
};
