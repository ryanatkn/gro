import {z} from 'zod';
import {plural, strip_end} from '@grogarden/util/string.js';
import {mkdir, writeFile} from 'node:fs/promises';

import {TaskError, type Task} from './task.js';
import {search_fs} from './search_fs.js';
import {paths} from './paths.js';
import {load_package_json, to_package_exports, update_package_json} from './package_json.js';
import {load_sveltekit_config} from './sveltekit_config.js';
import {exists} from './exists.js';

export const Args = z
	.object({
		// _ - maybe exclude?
		dir: z.string({description: 'directory to find files'}).default(paths.lib),
		include: z.string({description: 'regexp to match'}).default(''),
		exclude: z
			.string({description: 'regexp to not match'})
			.default('(\\.md|\\.(gen|test|ignore)\\.|\\/(test|fixtures|ignore)\\/)'),
		check: z.boolean({description: 'exit with a nonzero code if exports changed'}).default(false),
	})
	.strict();
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'writes the exports property of package.json for the lib',
	Args,
	run: async ({args: {dir, include, exclude, check}, config, log}): Promise<void> => {
		const exported_files = await search_fs(dir, {filter: create_exports_filter(include, exclude)});
		const exported_paths = Array.from(exported_files.keys());
		const exports = to_package_exports(exported_paths);
		const exports_count = Object.keys(exports).length;
		const changed = await update_package_json(config.package_json, 'exports', !check);

		if (check) {
			if (changed) {
				throw new TaskError(
					'Failed exports check. Some package.json exports have unexpectedly changed.' +
						' Run `gro exports` manually and check the `package_json` config option.',
				);
			} else {
				log.info('check passed, no package.json exports have changed');
			}
			return;
		}

		log.info(
			changed
				? `updated package.json exports with ${exports_count} total export${plural(exports_count)}`
				: 'no exports in package.json changed',
		);

		// add `/.well-known/package.json` as needed
		const pkg = await load_package_json();
		const including_package_json = !pkg.private;
		if (including_package_json) {
			const mapped = await config.package_json(pkg, 'well_known');
			if (mapped !== null) {
				// copy the `package.json` over to `static/.well-known/` if configured unless it exists
				const svelte_config = await load_sveltekit_config();
				const static_assets = svelte_config?.kit?.files?.assets || 'static';
				const well_known_dir = strip_end(static_assets, '/') + '/.well-known';
				if (!(await exists(well_known_dir))) {
					await mkdir(well_known_dir, {recursive: true});
				}
				const package_json_path = well_known_dir + '/package.json';
				if (!(await exists(package_json_path))) {
					await writeFile(package_json_path, JSON.stringify(mapped, null, 2));
				}
			}
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
