import type {Result} from '@ryanatkn/belt/result.js';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

import {has_dep, type Package_Json} from './package_json.js';
import type {Plugin} from './plugin.js';

export const MOSS_PACKAGE_DEP_NAME = '@ryanatkn/moss';

export const load_moss_plugin = async (
	package_json?: Package_Json,
	dep_name = MOSS_PACKAGE_DEP_NAME,
	plugin_path = `node_modules/${dep_name}/dist/gro_plugin_moss.js`, // TODO maybe lookup from its `package_json.exports`? kinda unnecessary
): Promise<Result<{value: Plugin}, {message: string}>> => {
	if (!has_dep(dep_name, package_json)) {
		return {
			ok: false,
			message: `no dependency found in package.json for ${dep_name}, install it with \`npm i -D ${dep_name}\``,
		};
	}

	if (!existsSync(plugin_path)) {
		return {
			ok: false,
			message: `dependency on ${dep_name} detected but plugin not found at ${plugin_path}`,
		};
	}

	const plugin = await import(resolve(plugin_path));
	return plugin.gro_plugin_moss_css;
};
