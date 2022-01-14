<script lang="ts">
	import SourceMetaBuildTreeExplorer from '$lib/app/SourceMetaBuildTreeExplorer.svelte';
	import SourceMetaTreeExplorer from '$lib/app/SourceMetaTreeExplorer.svelte';
	import {type SourceTree} from '$lib/app/sourceTree';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<div class="explorers">
	<SourceMetaBuildTreeExplorer {sourceTree} {selectedBuildNames} />
	<SourceMetaTreeExplorer {sourceTree} {selectedBuildNames} />
</div>

<style>
	.explorers {
		display: flex;
	}
</style>
