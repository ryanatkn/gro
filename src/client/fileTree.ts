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
