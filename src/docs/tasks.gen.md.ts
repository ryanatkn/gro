import {dirname, relative} from 'path';

import {Gen} from '../gen/gen.js';
import {createNodeRunHost} from '../run/nodeRunHost.js';
import {paths, toBasePath, toBuildId, toSourceId} from '../paths.js';
import {toTaskName} from '../run/task.js';

// This is the first simple implementation of Gro's automated docs.
// It combines Gro's gen and task systems
// to generate a markdown file describing all of the project's tasks.
// Other projects that use Gro should be able to import this module
// or other otherwise get frictionless access to this specific use case,
// and they should be able to extend or customize it to any degree.

// TODO needs some cleanup and better APIs
// TODO add backlinks to every document that links to this one

export const gen: Gen = async ({originId}) => {
	const {findTaskModules} = createNodeRunHost({logLevel: 0});
	const taskSourceIds = await findTaskModules(paths.source);

	// TODO render the footer with the originId
	return `# Felt tasks
 
## all tasks

${taskSourceIds.reduce(
	(taskList, id) =>
		taskList +
		`- [${toBasePath(toSourceId(toTaskName(toBuildId(id))))}](${relative(
			dirname(originId),
			id,
		)})\n`,
	'',
)}
[← back to docs](${relative(dirname(originId), toSourceId('docs')) || './'})

\`gen: ${JSON.stringify({originId})}\`
`;
};
