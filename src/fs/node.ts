import Cheap_Watch from 'cheap-watch';
import fs_extra from 'fs-extra';
import {sort_map, compare_simple_map_entries} from '@feltcoop/felt/util/map.js';

import type {Filesystem, Fs_Write_File} from 'src/fs/filesystem.js';
import type {Path_Stats} from 'src/fs/path_data.js';
import type {Path_Filter} from 'src/fs/path_filter.js';

// This uses `Cheap_Watch` which probably isn't the fastest, but it works fine for now.
// TODO should this API be changed to only include files and not directories?
// or maybe change the name so it's not misleading?
const find_files = async (
	dir: string,
	filter?: Path_Filter,
	// pass `null` to speed things up at the risk of rare misorderings
	sort: typeof compare_simple_map_entries | null = compare_simple_map_entries,
): Promise<Map<string, Path_Stats>> => {
	const watcher = new Cheap_Watch({
		dir,
		filter: filter
			? (file: {path: string; stats: Path_Stats}) => file.stats.isDirectory() || filter(file)
			: undefined,
		watch: false,
	});
	await watcher.init();
	watcher.close();
	return sort ? sort_map(watcher.paths, sort) : watcher.paths;
};

export const fs: Filesystem = {
	stat: fs_extra.stat,
	exists: fs_extra.pathExists,
	read_file: fs_extra.readFile,
	write_file: fs_extra.outputFile as Fs_Write_File, // TODO incompatible encodings: is this an actual problem? or is `fs-extra` mistyped? test with `null`
	remove: fs_extra.remove,
	move: fs_extra.move,
	copy: fs_extra.copy,
	read_dir: fs_extra.readdir,
	empty_dir: fs_extra.emptyDir,
	ensure_dir: fs_extra.ensureDir,
	find_files,
};
