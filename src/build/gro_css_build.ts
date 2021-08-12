import type {ExistingRawSourceMap} from 'rollup';

import type {CssBuild, CssBundle} from 'src/build/css_cache.js';

export interface GroCssBuild extends CssBuild {
	source_id: string; // for Svelte files, the `.svelte` version instead of `.css`
	sort_index: number; // sort order when css is concatenated - maybe make this optional?
	map: ExistingRawSourceMap | undefined;
}

export type GroCssBundle = CssBundle<GroCssBuild>;
