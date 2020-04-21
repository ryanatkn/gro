import {green} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {FileData} from '../files/fileData.js';
import {fmtPath} from '../utils/fmt.js';

export interface FileCache {
	readonly byId: Map<string, FileData>;
	get(id: string): FileData | undefined;
	set(file: FileData): void;
	update(id: string, partial: Partial<FileData>): FileData;
}

export const createFileCache = (): FileCache => {
	const {trace} = new SystemLogger([green('[fileCache]')]);

	const byId = new Map<string, FileData>();

	return {
		byId,
		get: id => byId.get(id),
		set: file => {
			trace('set', fmtPath(file.id));
			byId.set(file.id, file);
		},
		update: (id, partial): FileData => {
			trace('update', fmtPath(id), partial);
			const current = byId.get(id);
			if (!current) {
				throw Error(`Cannot update fileCache with unknown id: ${id}`);
			}
			const updated = {
				...current,
				...omitUndefined(partial),
			};
			byId.set(id, updated);
			return updated;
		},
	};
};
