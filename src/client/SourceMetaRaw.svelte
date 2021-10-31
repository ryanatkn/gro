<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceMetaRawItem from './SourceMetaRawItem.svelte';
	import {filterSelectedMetas} from './sourceTree';
	import type {SourceTree} from 'src/client/sourceTree.js';
	import type {SourceMeta} from 'src/build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaRawItem {sourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
