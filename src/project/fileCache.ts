import {green} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {PathData} from '../fs/pathData.js';
import {printPath} from '../utils/print.js';

export interface FileCache {
	readonly byId: Map<string, PathData>;
	get(id: string): PathData | undefined;
	set(file: PathData): void;
	update(id: string, partial: Partial<PathData>): PathData;
}

export const createFileCache = (): FileCache => {
	const log = new SystemLogger([green('[fileCache]')]);

	const byId = new Map<string, PathData>();

	return {
		byId,
		get: id => byId.get(id),
		set: file => {
			log.trace('set', printPath(file.id));
			byId.set(file.id, file);
		},
		update: (id, partial): PathData => {
			log.trace('update', printPath(id), partial);
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
