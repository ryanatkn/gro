import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

import {has_dep, type Package_Json} from './package_json.js';

export const MOSS_PACKAGE_DEP_NAME = '@ryanatkn/moss';

// TODO plugin type?
export const load_moss_plugin = async (
	package_json?: Package_Json,
	dep_name = MOSS_PACKAGE_DEP_NAME,
	plugin_path = `node_modules/${dep_name}/dist/gro_plugin_moss.js`, // TODO maybe lookup from its `package_json.exports`? kinda unnecessary
): Promise<Result<{gro_plugin_moss: any}, {message: string}>> => {
	if (!has_dep(dep_name, package_json)) {
		return {
			ok: false,
			message: `no dependency found in package.json for ${dep_name}, install it with \`npm i -D ${dep_name}\``,
		};
	}

	const path = resolve(plugin_path);
	if (!existsSync(path)) {
		return {
			ok: false,
			// TODO warn?
			message: `dependency on ${dep_name} detected but plugin not found at ${path}`,
		};
	}

	const mod = await import(path);
	return {ok: true, gro_plugin_moss: mod.gro_plugin_moss};
};
