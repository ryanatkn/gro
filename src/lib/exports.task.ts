import {z} from 'zod';
import {plural} from '@feltjs/util/string.js';

import type {Task} from './task/task.js';
import {search_fs} from './util/search_fs.js';
import {paths} from './util/paths.js';
import {to_package_exports, update_package_json_exports} from './util/package_json.js';

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
	summary: 'writes the exports property of package.json for the lib',
	Args,
	run: async ({args: {dir, include, exclude}, log}): Promise<void> => {
		const exported_files = await search_fs(dir, {filter: create_exports_filter(include, exclude)});
		const exported_paths = Array.from(exported_files.keys());
		const exports = to_package_exports(exported_paths);
		const exports_count = Object.keys(exports).length;
		const changed = await update_package_json_exports(exports);
		log.info(
			changed
				? 'no exports in package.json changed'
				: `updated package.json exports with ${exports_count} total export${plural(exports_count)}`,
		);
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
