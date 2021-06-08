<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceId from './SourceId.svelte';
	import type {Source_Meta} from '../build/source_meta.js';

	export let source_meta: Source_Meta;
	export let selected_source_meta: Writable<Source_Meta | null>;
	export let hovered_source_meta: Writable<Source_Meta | null>;

	// this allows you to default stuff to e.g. the selected if there's no hovered
	$: activeSource_Meta = $hovered_source_meta || $selected_source_meta;
	$: active = $hovered_source_meta ? hovered : selected;

	$: hovered = source_meta === $hovered_source_meta;
	$: selected = source_meta === $selected_source_meta;

	const onPointerDown = (e: PointerEvent) => {
		// TODO this needs to be done for all of the handlers..
		if (e.button !== 0) return;
		$selected_source_meta = selected ? null : source_meta;
	};
	const onPointerEnter = () => {
		$hovered_source_meta = source_meta;
	};
	const onPointerLeave = () => {
		if ($hovered_source_meta === source_meta) $hovered_source_meta = null;
	};

	// TODO need a better data structure for this
	const isDependency = (dependency: Source_Meta | null, dependent: Source_Meta | null) =>
		dependent &&
		dependency &&
		dependent !== dependency &&
		// omg this is a big O WTF
		dependent.data.builds.find((build1) =>
			build1.dependencies?.find((d) =>
				dependency.data.builds.find((build2) => build2.id === d.build_id),
			),
		);

	$: activeIsDependency = isDependency(activeSource_Meta, source_meta);
	$: activeIsDependent = isDependency(source_meta, activeSource_Meta);
	$: emphasized = activeIsDependency || activeIsDependent || active;
	$: deemphasized = activeSource_Meta && !emphasized;
	$: data = activeSource_Meta?.data!; // TODO this is a workaround for not having `!` in templates
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
