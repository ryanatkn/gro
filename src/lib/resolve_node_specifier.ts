import {join} from 'node:path';

import {load_package_json} from './package_json.js';
import {NODE_MODULES_DIRNAME, SourceId, paths} from './paths.js';

// TODO BLOCK move this to a new `resolve_node_specifier.ts` module if it's not hacky
export const resolve_node_specifier = async (
	specifier: string,
	dir = paths.root,
	parent_url?: string,
): Promise<SourceId> => {
	// TODO BLOCK implement properly -- lookup/cache package.json and resolve from `exports`, falling back to bare if not present (or throwing like the builtin?)
	console.log(`specifier`, specifier);
	console.log(`parent_url`, parent_url);
	const parsed = parse_node_specifier(specifier);
	const subpath = './' + parsed.path;
	console.log(`parsed`, parsed);
	const package_dir = join(dir, NODE_MODULES_DIRNAME, parsed.name);
	const package_json = await load_package_json(package_dir); // TODO BLOCK cache (maybe with an optional param)
	const exported = package_json.exports?.[subpath];
	if (!exported) {
		// This error matches Node's.
		throw Error(
			`[ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath '${subpath}' is not defined by "exports" in ${package_dir}/package.json` +
				(parent_url ? ` imported from ${parent_url}` : ''),
		);
	}
	console.log(`package_json.exports`, package_json.exports);
	console.log(`ex`, exported);
	const source_id = join(package_dir, exported.svelte || exported.default); // TODO hacky, should detect file type
	console.log(`source_id`, source_id);
	return source_id;
};

export interface ParsedNodeSpecifier {
	name: string;
	path: string;
}

export const parse_node_specifier = (specifier: string): ParsedNodeSpecifier => {
	let idx!: number;
	if (specifier[0] === '@') {
		// get the index of the second `/`
		let count = 0;
		for (let i = 0; i < specifier.length; i++) {
			if (specifier[i] === '/') count++;
			if (count === 2) {
				idx = i;
				break;
			}
		}
	} else {
		idx = specifier.indexOf('/');
	}
	return {
		name: specifier.substring(0, idx),
		path: specifier.substring(idx + 1),
	};
};
