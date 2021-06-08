<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceId from './SourceId.svelte';
	import type {SourceMeta} from '../build/source_meta.js';

	export let source_meta: SourceMeta;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	let expanded = false;
	$: expandedText = expanded ? '–' : '+';

	let hovering = false;

	const onPointerEnter = () => {
		hovering = true;
		$hoveredSourceMeta = source_meta;
	};
	const onPointerLeave = () => {
		hovering = false;
		if ($hoveredSourceMeta === source_meta) $hoveredSourceMeta = null;
	};

	// TODO probably want to do a better data structure than this
	const isDependency = (dependency: SourceMeta | null, dependent: SourceMeta | null) =>
		dependent &&
		dependency &&
		dependent !== dependency &&
		// omg this is a big O WTF
		dependent.data.builds.find((build1) =>
			build1.dependencies?.find((d) =>
				dependency.data.builds.find((build2) => build2.id === d.build_id),
			),
		);

	$: hoveredIsDependency = isDependency($hoveredSourceMeta, source_meta);
	$: hoveredIsDependent = isDependency(source_meta, $hoveredSourceMeta);
	$: deemphasized =
		$hoveredSourceMeta &&
		!hovering &&
		!(hoveredIsDependency || hoveredIsDependent || $hoveredSourceMeta === source_meta);
</script>

<div class="summary" class:deemphasized>
	<div class="dep">
		{#if hoveredIsDependency}↤{/if}
	</div>
	<div class="dep">
		{#if hoveredIsDependent}↦{/if}
	</div>
	<button
		on:pointerdown={() => (expanded = !expanded)}
		on:pointerenter={onPointerEnter}
		on:pointerleave={onPointerLeave}
		class:hovering
	>
		<span class="icon">{expandedText}</span>
		<SourceId id={source_meta.data.source_id} />
	</button>
</div>
{#if expanded}
	<pre>
      {JSON.stringify(source_meta, null, 2)}
    </pre>
	<button
		on:pointerdown={() => (expanded = !expanded)}
		on:pointerenter={onPointerEnter}
		on:pointerleave={onPointerLeave}
	>
		{expandedText}
	</button>
{/if}

<style>
	.summary {
		display: flex;
		align-items: center;
	}
	button {
		border: 0;
		background: transparent;
	}
	.hovering {
		text-decoration: underline;
	}
	.dep {
		height: 16px;
		width: 16px;
		line-height: 1;
	}
	.deemphasized {
		opacity: 0.62;
	}
	.icon {
		opacity: 0.6;
		padding-right: var(--spacing_sm);
	}
</style>
