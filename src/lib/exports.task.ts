import {z} from 'zod';
import {plural, strip_end} from '@grogarden/util/string.js';
import {mkdir, readFile, writeFile} from 'node:fs/promises';

import {TaskError, type Task} from './task.js';
import {search_fs} from './search_fs.js';
import {paths} from './paths.js';
import {
	load_package_json,
	serialize_package_json,
	to_package_exports,
	update_package_json,
	normalize_package_json,
} from './package_json.js';
import {load_sveltekit_config} from './sveltekit_config.js';
import {exists} from './exists.js';

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

// TODO BLOCK is `exports` the right name for this?

// TODO this is no longer a good name, either rename or factor out the .well-known stuff
// maybe `gro package`?
export const task: Task<Args> = {
	summary: 'write the "exports" property of package.json and copy the file to .well-known',
	Args,
	run: async ({args: {dir, include, exclude, check}, config, log}): Promise<void> => {
		const {package_json, well_known_package_json} = config;

		// map `package.json`
		const exported_files = await search_fs(dir, {filter: create_exports_filter(include, exclude)});
		const exported_paths = Array.from(exported_files.keys());
		const exports = to_package_exports(exported_paths);
		const exports_count = Object.keys(exports).length;
		const changed_exports = await update_package_json(async (pkg) => {
			pkg.exports = exports;
			const mapped = package_json ? await package_json(pkg) : pkg;
			return mapped ? normalize_package_json(mapped) : mapped;
		}, !check);

		if (check) {
			if (changed_exports) {
				throw new TaskError(failure_message('updating_exports'));
			} else {
				log.info('check passed for package.json for `updating_exports`');
			}
		} else {
			log.info(
				changed_exports
					? `updated package.json exports with ${exports_count} total export${plural(
							exports_count,
					  )}`
					: 'no changes to exports in package.json',
			);
		}
	},
};

// TODO extract?
const create_exports_filter = (include: string, exclude: string) => {
	const include_matcher = include && new RegExp(include, 'u');
	const exclude_matcher = exclude && new RegExp(exclude, 'u');
	return (path: string): boolean =>
		(!include_matcher || include_matcher.test(path)) &&
		(!exclude_matcher || !exclude_matcher.test(path));
};

const failure_message = (when: string): string =>
	'Failed exports check.' +
	` The package.json has unexpectedly changed at '${when}'.` +
	' Run `gro sync` or `gro exports` manually to inspect the changes, and check the `package_json` config option.';
