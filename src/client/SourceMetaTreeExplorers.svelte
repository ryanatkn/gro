<script lang="ts">
	import SourceMetaBuildTreeExplorer from './SourceMetaBuildTreeExplorer.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import type {SourceTree} from 'src/client/source_tree.js';

	export let source_tree: SourceTree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;
</script>

<div class="explorers">
	<SourceMetaBuildTreeExplorer {source_tree} {selected_build_names} />
	<SourceMetaTreeExplorer {source_tree} {selected_build_names} />
</div>

<style>
	.explorers {
		display: flex;
	}
</style>
