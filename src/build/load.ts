import {type Encoding} from '../fs/encoding.js';
import {type Filesystem} from '../fs/filesystem.js';

export const loadContent = <T extends Encoding>(
	fs: Filesystem,
	encoding: T,
	id: string,
): Promise<T extends 'utf8' ? string : string | Buffer> =>
	encoding === null ? fs.readFile(id) : (fs.readFile(id, encoding as any) as any);
