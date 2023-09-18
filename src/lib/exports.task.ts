import {z} from 'zod';

import type {Task} from './task/task.js';
import {search_fs} from './util/search_fs.js';
import {paths} from './util/paths.js';
import {update_package_json, to_package_exports} from './util/package_json.js';

export const Args = z
	.object({
		// _ - maybe exclude?
		dir: z.string({description: 'directory to find files'}).default(paths.lib),
		include: z.string({description: 'regexp to match'}).default(''),
		exclude: z
			.string({description: 'regexp to not match'})
			.default('(\\.md|\\.(gen|test|ignore)\\.|\\/(test|fixtures|ignore)\\/)'),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'writes the exports property of package.json',
	Args,
	run: async ({args: {dir, include, exclude}}): Promise<void> => {
		const files = await search_fs(dir, {filter: create_exports_filter(include, exclude)});
		const exports = to_package_exports(Array.from(files.keys()));
		await update_package_json((pkg) => ({...pkg, exports}));
	},
};

// TODO extract?
const create_exports_filter = (include: string, exclude: string) => {
	const include_matcher = include && new RegExp(include, 'u');
	const exclude_matcher = exclude && new RegExp(exclude, 'u');
	return (path: string): boolean =>
		(!include_matcher || include_matcher.test(path)) &&
		(!exclude_matcher || !exclude_matcher.test(path)); // eslint-disable-line @typescript-eslint/prefer-optional-chain
};
