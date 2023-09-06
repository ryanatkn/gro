import dotenv from 'dotenv';
import {readFileSync, existsSync} from 'node:fs'; // eslint-disable-line @typescript-eslint/no-restricted-imports
import {resolve} from 'node:path';

export const load_env = (
	dev: boolean,
	visibility: 'public' | 'private',
	public_prefix: string,
	private_prefix: string,
	env_dir?: string,
	env_files = ['.env', '.env.' + (dev ? 'development' : 'production')],
	ambient_env = process.env,
): Record<string, string> => {
	const envs: Array<Record<string, string | undefined>> = [];
	for (const path of env_files) {
		const resolved = env_dir === undefined ? path : resolve(env_dir, path);
		const loaded = load(resolved);
		if (loaded) envs.push(loaded);
	}
	envs.push(ambient_env);
	return merge_envs(envs, visibility, public_prefix, private_prefix);
};

const load = (path: string): null | Record<string, string> => {
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
				(visibility === 'private' && is_private_env(key, public_prefix, private_prefix)) ||
				(visibility === 'public' && is_public_env(key, public_prefix, private_prefix))
			) {
				const value = e[key];
				if (value !== undefined) env[key] = value;
			}
		}
	}

	return env;
};

export const is_private_env = (
	key: string,
	public_prefix: string,
	private_prefix: string,
): boolean =>
	key.startsWith(private_prefix) && (public_prefix === '' || !key.startsWith(public_prefix));

export const is_public_env = (
	key: string,
	public_prefix: string,
	private_prefix: string,
): boolean =>
	key.startsWith(public_prefix) && (private_prefix === '' || !key.startsWith(private_prefix));
