import type {Path_Id} from './path.js';

export interface Source_File {
	id: Path_Id;
	contents: string;
	dependents: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
}

export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	get_by_id = (id: Path_Id): Source_File | undefined => {
		return this.files.get(id);
	};

	add = (id: Path_Id, contents: string): Source_File => {
		// TODO BLOCK resolve specifiers
		// TODO BLOCK handle existing?
		const source_file: Source_File = {
			id,
			contents,
			dependents: new Map(),
		};
		this.files.set(id, source_file);
		return source_file;
	};

	remove = (id: Path_Id): Source_File | undefined => {
		const found = this.get_by_id(id);
		if (!found) return undefined;
		// TODO BLOCK remove from dependents
		this.files.delete(id);
		return found;
	};
}
