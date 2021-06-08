<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Source_Id from './Source_Id.svelte';
	import type {Source_Meta} from '../build/source_meta.js';

	export let source_meta: Source_Meta;
	export let selected_source_meta: Writable<Source_Meta | null>;
	export let hovered_source_meta: Writable<Source_Meta | null>;

	// this allows you to default stuff to e.g. the selected if there's no hovered
	$: active_source_meta = $hovered_source_meta || $selected_source_meta;
	$: active = $hovered_source_meta ? hovered : selected;

	$: hovered = source_meta === $hovered_source_meta;
	$: selected = source_meta === $selected_source_meta;

	const on_pointer_down = (e: PointerEvent) => {
		// TODO this needs to be done for all of the handlers..
		if (e.button !== 0) return;
		$selected_source_meta = selected ? null : source_meta;
	};
	const on_pointer_enter = () => {
		$hovered_source_meta = source_meta;
	};
	const on_pointer_leave = () => {
		if ($hovered_source_meta === source_meta) $hovered_source_meta = null;
	};

	// TODO need a better data structure for this
	const is_dependency = (dependency: Source_Meta | null, dependent: Source_Meta | null) =>
		dependent &&
		dependency &&
		dependent !== dependency &&
		// omg this is a big O WTF
		dependent.data.builds.find((build1) =>
			build1.dependencies?.find((d) =>
				dependency.data.builds.find((build2) => build2.id === d.build_id),
			),
		);

	$: active_is_dependency = is_dependency(active_source_meta, source_meta);
	$: active_is_dependent = is_dependency(source_meta, active_source_meta);
	$: emphasized = active_is_dependency || active_is_dependent || active;
	$: deemphasized = active_source_meta && !emphasized;
	$: data = active_source_meta?.data!; // TODO this is a workaround for not having `!` in templates
</script>

<div class="summary" class:deemphasized class:emphasized>
	<div class="dep">
		{#if active_is_dependency}
			<span title="{source_meta.data.source_id} has a dependency on {data.source_id}">↤</span>
		{/if}
	</div>
	<div class="dep">
		{#if active_is_dependent}
			<span title="{source_meta.data.source_id} is a dependency of {data.source_id}">↦</span>
		{/if}
	</div>
	<button
		on:pointerdown={on_pointer_down}
		on:pointerenter={on_pointer_enter}
		on:pointerleave={on_pointer_leave}
		class:hovered
		class:selected
	>
		<Source_Id id={source_meta.data.source_id} />
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
