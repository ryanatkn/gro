import dotenv from 'dotenv';
import {readFileSync, existsSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports

export const load_env = (path: string): dotenv.DotenvParseOutput => {
	if (existsSync(path)) {
		const content = readFileSync(path, 'utf8');
		const parsed = dotenv.parse(content);
		console.log(`parsed`, parsed);
		return parsed;
	}
	return {}; // TODO BLOCK
};
