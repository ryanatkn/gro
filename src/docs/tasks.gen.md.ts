import {dirname, relative, basename} from 'path';
import {toPathParts, to_path_segments} from '@feltcoop/felt/util/path.js';
import {strip_start} from '@feltcoop/felt/util/string.js';
import {last} from '@feltcoop/felt/util/array.js';

import {Gen, to_output_file_name} from '../gen/gen.js';
import {paths, base_path_to_source_id} from '../paths.js';
import {load_task_modules} from '../task/task_module.js';

// This is the first simple implementation of Gro's automated docs.
// It combines Gro's gen and task systems
// to generate a markdown file describing all of the project's tasks.
// Other projects that use Gro should be able to import this module
// or other otherwise get frictionless access to this specific use case,
// and they should be able to extend or customize it to any degree.

// TODO display more info about each task, including a description and params
// TODO needs some cleanup and better APIs - paths are confusing and verbose!
// TODO add backlinks to every document that links to this one

export const gen: Gen = async ({fs, origin_id}) => {
	const result = await load_task_modules(fs);
	if (!result.ok) {
		for (const reason of result.reasons) {
			console.log(reason); // TODO logger as argument
		}
		throw new Error(result.type);
	}
	const tasks = result.modules;

	// TODO need to get this from project config or something
	const rootPath = last(to_path_segments(paths.root));

	const originDir = dirname(origin_id);
	const originBase = basename(origin_id);

	const baseDir = paths.source;
	const relativePath = strip_start(origin_id, baseDir);
	const relativeDir = dirname(relativePath);

	// TODO should this be passed in the context, like `defaultOutputFileName`?
	const outputFileName = to_output_file_name(originBase);

	// TODO this is GitHub-specific
	const rootLink = `[${rootPath}](/../..)`;

	// TODO do we want to use absolute paths instead of relative paths,
	// because GitHub works with them and it simplifies the code?
	const pathParts = toPathParts(relativeDir).map(
		(relativePathPart) =>
			`[${last(to_path_segments(relativePathPart))}](${
				relative(originDir, base_path_to_source_id(relativePathPart)) || './'
			})`,
	);
	const breadcrumbs = '> <sub>' + [rootLink, ...pathParts, outputFileName].join(' / ') + '</sub>';

	// TODO render the footer with the origin_id
	return `# tasks

${breadcrumbs}

What is a \`Task\`? See [\`src/tasks/README.md\`](../task).

## all tasks

${tasks.reduce(
	(taskList, task) =>
		taskList +
		`- [${task.name}](${relative(originDir, task.id)})${
			task.mod.task.description ? ` - ${task.mod.task.description}` : ''
		}\n`,
	'',
)}
## usage

\`\`\`bash
$ gro some/task/name
\`\`\`

${breadcrumbs}

> <sub>generated by [${originBase}](${originBase})</sub>
`;
};
