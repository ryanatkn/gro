import {green} from 'kleur';

import {LogLevel, logger} from '../utils/logUtils.js';
import {omitUndefined} from '../utils/objectUtils.js';
import {FileData} from './fileData.js';
import {toRootPath} from '../paths.js';

export interface FileCache {
	readonly byId: Map<string, FileData>;
	get(id: string): FileData | undefined;
	set(file: FileData): void;
	update(id: string, partial: Partial<FileData>): FileData;
}

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...omitUndefined(opts),
});

export const createFileCache = (opts: InitialOptions = {}): FileCache => {
	const {logLevel} = initOptions(opts);

	const {info} = logger(logLevel, [green('[fileCache]')]);

	const byId = new Map<string, FileData>();

	return {
		byId,
		get: id => byId.get(id),
		set: file => {
			info('set', green(toRootPath(file.id)));
			byId.set(file.id, file);
		},
		update: (id, partial): FileData => {
			info('update', green(toRootPath(id)), partial);
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
