import {readFile} from '../fs/nodeFs.js';
import {Encoding} from '../fs/encoding.js';

export const loadContents = (encoding: Encoding, id: string): Promise<string | Buffer> =>
	encoding === null ? readFile(id) : readFile(id, encoding);
