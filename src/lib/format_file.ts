import prettier from 'prettier';

import {load_package_json} from './package_json.js';

let cached_base_options: prettier.Options | undefined;

/**
 * Formats a file with Prettier.
 * @param content
 * @param options
 * @param base_options - defaults to the the cwd's package.json `prettier` value
 */
export const format_file = async (
	content: string,
	options?: prettier.Options | undefined,
	base_options: prettier.Options | null | undefined = cached_base_options,
): Promise<string> => {
	const final_base_options =
		base_options !== undefined
			? base_options
			: (cached_base_options = (await load_package_json()).prettier as any);
	try {
		return await prettier.format(content, {...final_base_options, ...options});
	} catch (err) {
		return content;
	}
};
