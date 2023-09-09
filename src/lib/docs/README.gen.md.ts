import {dirname, relative, basename} from 'node:path';
import {toPathParts, toPathSegments} from '@feltjs/util/path-parsing.js';
import {stripStart} from '@feltjs/util/string.js';

import {type Gen, toOutputFileName} from '../gen/gen.js';
import {paths, base_path_to_source_id} from '../path/paths.js';
import {find_files} from '../fs/find_files.js';

// This renders a simple index of a possibly nested directory of files.

// TODO look at `tasks.gen.md.ts` to refactor and generalize
// TODO show nested structure, not a flat list
// TODO work with file types beyond markdown

export const gen: Gen = async ({origin_id}) => {
	// TODO need to get this from project config or something
	const root_path = toPathSegments(paths.root).at(-1);

	const origin_dir = dirname(origin_id);
	const origin_base = basename(origin_id);

	const base_dir = paths.source;
	const relative_path = stripStart(origin_id, base_dir);
	const relative_dir = dirname(relative_path);

	// TODO should this be passed in the context, like `defaultOutputFileName`?
	const output_file_name = toOutputFileName(origin_base);

	// TODO this is GitHub-specific
	const root_link = `[${root_path}](/../..)`;
	const docFiles = await find_files(origin_dir, undefined, undefined, true);
	const docPaths: string[] = [];
	for (const path of docFiles.keys()) {
		if (path === output_file_name || !path.endsWith('.md')) {
			continue;
		}
		docPaths.push(path);
	}

	// TODO do we want to use absolute paths instead of relative paths,
	// because GitHub works with them and it simplifies the code?
	const isIndexFile = output_file_name === 'README.md';
	const path_parts = toPathParts(relative_dir).map((relative_pathPart) =>
		isIndexFile && relative_pathPart === relative_dir
			? relative_pathPart
			: `[${toPathSegments(relative_pathPart).at(-1)}](${
					relative(origin_dir, base_path_to_source_id(relative_pathPart)) || './'
			  })`,
	);
	const breadcrumbs =
		'> <sub>' + [root_link, ...path_parts, output_file_name].join(' / ') + '</sub>';

	// TODO render the footer with the origin_id
	return `# docs

${breadcrumbs}

${docPaths.reduce((docList, doc) => docList + `- [${basename(doc, '.md')}](${doc})\n`, '')}
${breadcrumbs}

> <sub>generated by [${origin_base}](${origin_base})</sub>
`;
};
