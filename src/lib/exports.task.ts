import {z} from 'zod';
import {plural} from '@grogarden/util/string.js';

import {TaskError, type Task} from './task.js';
import {search_fs} from './search_fs.js';
import {paths} from './paths.js';
import {to_package_exports, update_package_json, normalize_package_json} from './package_json.js';

export const Args = z
	.object({
		dir: z.string({description: 'directory to find files'}).default(paths.lib),
		include: z.string({description: 'regexp to match'}).default(''),
		exclude: z
			.string({description: 'regexp to not match'})
			.default('(\\.md|\\.(gen|test|ignore)\\.|\\/(test|fixtures|ignore)\\/)'),
		check: z.boolean({description: 'exit with a nonzero code if exports changed'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

// TODO BLOCK is `exports` the right name for this? maybe it should be `pkg` instead?

// TODO this is no longer a good name, either rename or factor out the .well-known stuff
// maybe `gro package`?
export const task: Task<Args> = {
	summary: 'write the "exports" property of package.json and copy the file to .well-known',
	Args,
	run: async ({args: {dir, include, exclude, check}, config, log}): Promise<void> => {},
};

// TODO extract? or use rollup pluginutils?
const create_exports_filter = (include: string, exclude: string) => {
	const include_matcher = include && new RegExp(include, 'u');
	const exclude_matcher = exclude && new RegExp(exclude, 'u');
	return (path: string): boolean =>
		(!include_matcher || include_matcher.test(path)) &&
		(!exclude_matcher || !exclude_matcher.test(path));
};
