<script lang="ts">
	import type {Writable} from 'svelte/store';

	import BuildName from './BuildName.svelte';
	import PlatformName from './PlatformName.svelte';
	import {get_metas_by_build_name} from './source_tree.js';
	import type {SourceTree} from 'src/client/source_tree.js';
	import type {View} from 'src/client/view.js';
	import type {SourceMeta} from 'src/build/source_meta.js';

	export let source_tree: SourceTree;
	export let selected_build_names: string[];
	export let active_source_meta_view: View;
	export let selected_source_meta: Writable<SourceMeta | null>;
	export let hovered_source_meta: Writable<SourceMeta | null>;
</script>

<div class="source-meta">
	<form>
		{#each source_tree.build_configs as build_config (build_config.name)}
			<div>
				<label>
					<input type="checkbox" bind:group={selected_build_names} value={build_config.name} />
					<BuildName build_name={build_config.name} />
					<small>
						({get_metas_by_build_name(source_tree, build_config.name).length})

						<PlatformName platform_name={build_config.platform} />
					</small>
				</label>
			</div>
		{/each}
	</form>
	<svelte:component
		this={active_source_meta_view}
		{source_tree}
		{selected_source_meta}
		{hovered_source_meta}
		{selected_build_names}
	/>
</div>
