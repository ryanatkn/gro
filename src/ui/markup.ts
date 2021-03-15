export interface BaseMarkupNode {
	type: string;
	id: number; // TODO
	// optional properties that any node type can have - trying to stick close to Activity Streams
	children?: BaseMarkupNode[];
	content?: string;
}

export type MarkupNode = MarkupBlockNode | MarkupTextNode;

export interface MarkupBlockNode extends BaseMarkupNode {
	type: 'Block';
	children: MarkupNode[];
}

export interface MarkupTextNode extends BaseMarkupNode {
	type: 'Text';
	content: string;
}
