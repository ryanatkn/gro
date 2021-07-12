import type {ExistingRawSourceMap} from 'rollup';

import type {Css_Build, Css_Bundle} from 'src/build/css_cache.js';

export interface Gro_Css_Build extends Css_Build {
	source_id: string; // for Svelte files, the `.svelte` version instead of `.css`
	sort_index: number; // sort order when css is concatenated - maybe make this optional?
	map: ExistingRawSourceMap | undefined;
}

export type Gro_Css_Bundle = Css_Bundle<Gro_Css_Build>;
