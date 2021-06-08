import type {Encoding} from '../fs/encoding.js';
import type {Filesystem} from '../fs/filesystem.js';

export const load_contents = <T extends Encoding>(
	fs: Filesystem,
	encoding: T,
	id: string,
): Promise<T extends 'utf8' ? string : string | Buffer> =>
	encoding === null ? fs.read_file(id) : (fs.read_file(id, encoding as any) as any);
