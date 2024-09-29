import type {Path_Id} from './path.js';
import type {Watch_Node_Fs, Watcher_Change} from './watch_dir.js';

export interface Source_File {
	id: Path_Id;
	contents: string;
	dependents: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
}

export type Cleanup_Watch = () => void;

export type On_Filer_Change = (change: Watcher_Change, source_file: Source_File) => void;

// TODO BLOCK use `watch_dir` - maybe also `search_fs` for non-watch cases? do we have any of those?
// TODO BLOCK lazy init - should be able to create the class without doing any significant work
export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	watcher: Watch_Node_Fs | undefined;

	get_by_id = (id: Path_Id): Source_File | undefined => {
		return this.files.get(id);
	};

	add = (id: Path_Id, contents: string): Source_File => {
		// TODO BLOCK resolve specifiers - `resolve_specifier` and `resolve_node_specifier`
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

	listeners: Set<On_Filer_Change> = new Set();

	watch = (listener: On_Filer_Change): Cleanup_Watch => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	close = async (): Promise<void> => {
		this.listeners.clear();
		await this.watcher?.close();
	};
}
