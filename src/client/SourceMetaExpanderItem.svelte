<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceId from './SourceId.svelte';
	import type {SourceMeta} from 'src/build/sourceMeta.js';

	export let sourceMeta: SourceMeta;
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	// this allows you to default stuff to e.g. the selected if there's no hovered
	$: activeSourceMeta = $hoveredSourceMeta || $selectedSourceMeta;
	$: active = $hoveredSourceMeta ? hovered : selected;

	$: hovered = sourceMeta === $hoveredSourceMeta;
	$: selected = sourceMeta === $selectedSourceMeta;

	const onPointerDown = (e: PointerEvent) => {
		// TODO this needs to be done for all of the handlers..
		if (e.button !== 0) return;
		$selectedSourceMeta = selected ? null : sourceMeta;
	};
	const onPointerEnter = () => {
		$hoveredSourceMeta = sourceMeta;
	};
	const onPointerLeave = () => {
		if ($hoveredSourceMeta === sourceMeta) $hoveredSourceMeta = null;
	};

	// TODO need a better data structure for this
	const isDependency = (dependency: SourceMeta | null, dependent: SourceMeta | null) =>
		dependent &&
		dependency &&
		dependent !== dependency &&
		// omg this is a big O WTF
		dependent.data.builds.find((build1) =>
			build1.dependencies?.find((d) =>
				dependency.data.builds.find((build2) => build2.id === d.buildId),
			),
		);

	$: activeIsDependency = isDependency(activeSourceMeta, sourceMeta);
	$: activeIsDependent = isDependency(sourceMeta, activeSourceMeta);
	$: emphasized = activeIsDependency || activeIsDependent || active;
	$: deemphasized = activeSourceMeta && !emphasized;
	$: data = activeSourceMeta?.data!; // TODO this is a workaround for not having `!` in templates
</script>

<div class="summary" class:deemphasized class:emphasized>
	<div class="dep">
		{#if activeIsDependency}
			<span title="{sourceMeta.data.sourceId} has a dependency on {data.sourceId}">↤</span>
		{/if}
	</div>
	<div class="dep">
		{#if activeIsDependent}
			<span title="{sourceMeta.data.sourceId} is a dependency of {data.sourceId}">↦</span>
		{/if}
	</div>
	<button
		on:pointerdown={onPointerDown}
		on:pointerenter={onPointerEnter}
		on:pointerleave={onPointerLeave}
		class:hovered
		class:selected
	>
		<SourceId id={sourceMeta.data.sourceId} />
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
