import {Gen} from '../gen/gen.js';
import {getExtensions} from '../fs/mime.js';
import {renderTsHeaderAndFooter} from '../gen/helpers/ts.js';

export const gen: Gen = async ({originId}) => {
	return renderTsHeaderAndFooter(
		{originId},
		`
// note: in environments where bundle size is important,
// prefer this module to using /src/fs/mime.ts when possible

// this list can be mutated after importing
export const DEFAULT_ASSET_PATHS: string[] = [${Array.from(getExtensions())
			.map((e) => `'${e}'`)
			.join(',')}];
`,
	);
};
