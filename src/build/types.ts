import {ExistingRawSourceMap} from 'rollup';

import {CssBuild, CssBundle} from './cssCache';

export interface GroCssBuild extends CssBuild {
	sourceId: string; // for Svelte files, the `.svelte` version instead of `.css`
	sortIndex: number; // sort order when css is concatenated - maybe make this optional?
	map: ExistingRawSourceMap | undefined;
}

export type GroCssBundle = CssBundle<GroCssBuild>;
