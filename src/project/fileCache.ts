import {green} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {PathData} from '../files/pathData.js';
import {fmtPath} from '../utils/fmt.js';

export interface FileCache {
	readonly byId: Map<string, PathData>;
	get(id: string): PathData | undefined;
	set(file: PathData): void;
	update(id: string, partial: Partial<PathData>): PathData;
}

export const createFileCache = (): FileCache => {
	const {trace} = new SystemLogger([green('[fileCache]')]);

	const byId = new Map<string, PathData>();

	return {
		byId,
		get: id => byId.get(id),
		set: file => {
			trace('set', fmtPath(file.id));
			byId.set(file.id, file);
		},
		update: (id, partial): PathData => {
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
