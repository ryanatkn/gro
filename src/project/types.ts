import type {ExistingRawSourceMap} from 'rollup';

import type {CssBuild, CssBundle} from './cssCache.js';

export interface GroCssBuild extends CssBuild {
	sourceId: string; // for Svelte files, the `.svelte` version instead of `.css`
	sortIndex: number; // sort order when css is concatenated - maybe make this optional?
	map: ExistingRawSourceMap | undefined;
}

export type GroCssBundle = CssBundle<GroCssBuild>;
