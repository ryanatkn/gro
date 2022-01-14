<script lang="ts">
	import {type Writable} from 'svelte/store';

	import SourceMetaExpanderItem from '$lib/app/SourceMetaExpanderItem.svelte';
	import {filterSelectedMetas, type SourceTree} from '$lib/app/sourceTree';
	import type {SourceMeta} from '../../build/sourceMeta';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaExpanderItem {sourceMeta} {selectedSourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
