import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

import {has_dep, type Package_Json} from './package_json.js';
import {NODE_MODULES_DIRNAME, PM_CLI_DEFAULT} from './constants.js';

export const MOSS_PACKAGE_DEP_NAME = '@ryanatkn/moss';

// TODO plugin type?
export const load_moss_plugin = async (
	package_json?: Package_Json,
	dep_name = MOSS_PACKAGE_DEP_NAME,
	plugin_path = `${NODE_MODULES_DIRNAME}/${dep_name}/dist/gro_plugin_moss.js`, // TODO maybe lookup from its `package_json.exports`? kinda unnecessary
	local_plugin_path = 'src/lib/gro_plugin_moss.ts',
	pm_cli = PM_CLI_DEFAULT, // TODO source from config when possible, is just needed for error messages
): Promise<Result<{gro_plugin_moss: any}, {message: string}>> => {
	if (!has_dep(dep_name, package_json)) {
		return {
			ok: false,
			message: `no dependency found in package.json for ${dep_name}, install it with \`${pm_cli} install -D ${dep_name}\``,
		};
	}

	let path: string | undefined = undefined;

	const resolved_local_plugin_path = resolve(local_plugin_path);
	if (existsSync(resolved_local_plugin_path)) {
		path = resolved_local_plugin_path;
	}

	if (path === undefined) {
		path = resolve(plugin_path);
		if (!existsSync(path)) {
			return {
				ok: false,
				// TODO warn?
				message: `dependency on ${dep_name} detected but plugin not found at ${path}`,
			};
		}
	}

	const mod = await import(path);
	return {ok: true, gro_plugin_moss: mod.gro_plugin_moss};
};
