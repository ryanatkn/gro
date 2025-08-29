import dotenv from 'dotenv';
import {resolve} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';

export const load_env = (
	dev: boolean,
	visibility: 'public' | 'private',
	public_prefix: string,
	private_prefix: string,
	env_dir?: string,
	env_files = ['.env', '.env.' + (dev ? 'development' : 'production')],
	ambient_env = process.env,
): Record<string, string> => {
	console.log(`[DEBUG] load_env called: dev=${dev}, visibility=${visibility}, public_prefix=${public_prefix}, env_dir=${env_dir}, env_files=${JSON.stringify(env_files)}`);
	const envs: Array<Record<string, string | undefined>> = env_files
		.map((path) => {
			const full_path = env_dir === undefined ? path : resolve(env_dir, path);
			console.log(`[DEBUG] Attempting to load env file: ${full_path}`);
			const loaded = load(full_path);
			console.log(`[DEBUG] Loaded env from ${full_path}:`, loaded);
			return loaded;
		})
		.filter((v) => v !== undefined);
	envs.push(ambient_env);
	console.log(`[DEBUG] All loaded envs:`, envs);
	const result = merge_envs(envs, visibility, public_prefix, private_prefix);
	console.log(`[DEBUG] Final merged env result:`, result);
	return result;
};

const load = (path: string): Record<string, string> | undefined => {
	if (!existsSync(path)) return;
	const loaded = readFileSync(path, 'utf8');
	return dotenv.parse(loaded);
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

/**
 * Loads a single env value without merging it into `process.env`.
 * By default searches process.env, then a local `.env` if one exists, then `../.env` if it exists.
 */
export const load_from_env = (key: string, paths = ['.env', '../.env']): string | undefined => {
	if (process.env[key]) return process.env[key];
	for (const path of paths) {
		const env = load(path);
		if (env?.[key]) return env[key];
	}
	return undefined;
};
