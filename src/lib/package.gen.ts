import type {Gen} from './gen.js';
import {load_package_json, to_package_modules} from './package_json.js';
import {is_this_project_gro} from './paths.js';

// TODO consider an api that uses magic imports like SvelteKit's `$app`, like `$repo/package.json`

/**
 * A convenience `gen` file that outputs `$lib/package.ts`,
 * which mirrors `package.json` but in TypeScript,
 * allowing apps to import typesafe data from their own `package.json`.
 */
export const gen: Gen = async ({log}) => {
	const package_json = await load_package_json();

	const modules = await to_package_modules(package_json.exports, log);

	package_json.modules = modules;

	return `
import type {PackageJson} from '${
		is_this_project_gro ? './package_json.js' : '@grogarden/gro/package_json.js'
	}';

export const package_json = ${JSON.stringify(package_json)} satisfies PackageJson;
	`;
};
