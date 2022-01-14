<script lang="ts">
	import {type Writable} from 'svelte/store';

	import SourceMetaRawItem from '$lib/app/SourceMetaRawItem.svelte';
	import {filterSelectedMetas, type SourceTree} from '$lib/app/sourceTree';
	import {type SourceMeta} from '../../build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaRawItem {sourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
