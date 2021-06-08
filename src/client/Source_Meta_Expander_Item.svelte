<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceId from './SourceId.svelte';
	import type {SourceMeta} from '../build/source_meta.js';

	export let source_meta: SourceMeta;
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	// this allows you to default stuff to e.g. the selected if there's no hovered
	$: activeSourceMeta = $hoveredSourceMeta || $selectedSourceMeta;
	$: active = $hoveredSourceMeta ? hovered : selected;

	$: hovered = source_meta === $hoveredSourceMeta;
	$: selected = source_meta === $selectedSourceMeta;

	const onPointerDown = (e: PointerEvent) => {
		// TODO this needs to be done for all of the handlers..
		if (e.button !== 0) return;
		$selectedSourceMeta = selected ? null : source_meta;
	};
	const onPointerEnter = () => {
		$hoveredSourceMeta = source_meta;
	};
	const onPointerLeave = () => {
		if ($hoveredSourceMeta === source_meta) $hoveredSourceMeta = null;
	};

	// TODO need a better data structure for this
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

	$: activeIsDependency = isDependency(activeSourceMeta, source_meta);
	$: activeIsDependent = isDependency(source_meta, activeSourceMeta);
	$: emphasized = activeIsDependency || activeIsDependent || active;
	$: deemphasized = activeSourceMeta && !emphasized;
	$: data = activeSourceMeta?.data!; // TODO this is a workaround for not having `!` in templates
</script>

<div class="summary" class:deemphasized class:emphasized>
	<div class="dep">
		{#if activeIsDependency}
			<span title="{source_meta.data.source_id} has a dependency on {data.source_id}">↤</span>
		{/if}
	</div>
	<div class="dep">
		{#if activeIsDependent}
			<span title="{source_meta.data.source_id} is a dependency of {data.source_id}">↦</span>
		{/if}
	</div>
	<button
		on:pointerdown={onPointerDown}
		on:pointerenter={onPointerEnter}
		on:pointerleave={onPointerLeave}
		class:hovered
		class:selected
	>
		<SourceId id={source_meta.data.source_id} />
	</button>
</div>

<style>
	.summary {
		display: flex;
		align-items: center;
	}
	button {
		border: 0;
		background: transparent;
	}
	.hovered {
		text-decoration: underline;
	}
	.selected {
		font-weight: bold;
	}
	.dep {
		height: 16px;
		width: 16px;
		line-height: 1;
	}
	.deemphasized {
		opacity: 0.61;
	}
	.emphasized {
		position: sticky;
		top: 0;
		bottom: 0;
	}
</style>
