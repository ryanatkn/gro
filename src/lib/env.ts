import dotenv from 'dotenv';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

import {exists} from './exists.js';

export const load_env = async (
	dev: boolean,
	visibility: 'public' | 'private',
	public_prefix: string,
	private_prefix: string,
	env_dir?: string,
	env_files = ['.env', '.env.' + (dev ? 'development' : 'production')],
	ambient_env = process.env,
): Promise<Record<string, string>> => {
	const envs: Array<Record<string, string | undefined>> = await Promise.all(
		env_files
			.map(async (path) => (await load(env_dir === undefined ? path : resolve(env_dir, path)))!)
			.filter(Boolean),
	);
	envs.push(ambient_env);
	return merge_envs(envs, visibility, public_prefix, private_prefix);
};

const load = async (path: string): Promise<Record<string, string> | null> => {
	if (!(await exists(path))) return null;
	const source = await readFile(path, 'utf8');
	const parsed = dotenv.parse(source);
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
