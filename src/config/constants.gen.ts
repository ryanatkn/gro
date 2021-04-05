import {Gen} from '../gen/gen.js';
import {getExtensions} from '../fs/mime.js';
import {renderTsHeaderAndFooter} from '../gen/helpers/ts.js';

export const gen: Gen = async ({originId}) => {
	return renderTsHeaderAndFooter(
		{originId},
		`
// note: if bundle size is an issue, prefer this module to using /src/fs/mime.ts when possible

// these can be mutated at init
export const DEFAULT_ASSET_PATHS: string[] = [${Array.from(getExtensions())
			.map((e) => `'${e}'`)
			.join(', ')}]; 
`,
	);
};
