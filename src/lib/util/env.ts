import dotenv from 'dotenv';
import {readFileSync, existsSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports
import {resolve} from 'node:path';

export const load_env = (
	dev: boolean,
	visibility: 'public' | 'private',
	public_prefix: string,
	private_prefix: string,
	env_dir?: string,
	ambient_env = process.env,
	paths = ['.env', '.env.' + (dev ? 'development' : 'production')],
): Record<string, string> => {
	const envs: Array<Record<string, string | undefined>> = [];
	for (const path of paths) {
		const resolved = env_dir === undefined ? path : resolve(env_dir, path);
		const loaded = load(resolved);
		if (loaded) envs.push(loaded);
	}
	envs.push(ambient_env);
	return merge_envs(envs, visibility, public_prefix, private_prefix);
};

export const load = (path: string): null | Record<string, string> => {
	if (!existsSync(path)) return null;
	const content = readFileSync(path, 'utf8');
	const parsed = dotenv.parse(content);
	return parsed;
};

export const merge_envs = (
	envs: Array<Record<string, string | undefined>>,
	visibility: 'public' | 'private',
	public_prefix: string,
	private_prefix: string,
): Record<string, string> => {
	const env: Record<string, string> = {};

	for (const e of envs) {
		for (const key in e) {
			if (
				(visibility === 'private' &&
					key.startsWith(private_prefix) &&
					(public_prefix === '' || !key.startsWith(public_prefix))) ||
				(visibility === 'public' &&
					key.startsWith(public_prefix) &&
					(private_prefix === '' || !key.startsWith(private_prefix)))
			) {
				const value = e[key];
				if (value !== undefined) env[key] = value;
			}
		}
	}

	return env;
};
