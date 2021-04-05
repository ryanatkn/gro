import {Gen} from '../gen/gen.js';
import {getExtensions} from '../fs/mime.js';
import {renderTsHeaderAndFooter} from '../gen/helpers/ts.js';

// This is the first simple implementation of Gro's automated docs.
// It combines Gro's gen and task systems
// to generate a markdown file describing all of the project's tasks.
// Other projects that use Gro should be able to import this module
// or other otherwise get frictionless access to this specific use case,
// and they should be able to extend or customize it to any degree.

// TODO display more info about each task, including a description and params
// TODO needs some cleanup and better APIs - paths are confusing and verbose!
// TODO add backlinks to every document that links to this one

export const gen: Gen = async ({originId}) => {
	return renderTsHeaderAndFooter(
		{originId},
		`
// these can be mutated at init
export const DEFAULT_ASSET_PATHS: string[] = [${Array.from(getExtensions())
			.map((e) => `'${e}'`)
			.join(', ')}]; 
`,
	);
};
