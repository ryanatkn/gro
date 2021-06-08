<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Source_Id from './Source_Id.svelte';
	import type {Source_Meta} from '../build/source_meta.js';

	export let source_meta: Source_Meta;
	export let hovered_source_meta: Writable<Source_Meta | null>;

	let expanded = false;
	$: expanded_text = expanded ? '–' : '+';

	let hovering = false;

	const on_pointer_enter = () => {
		hovering = true;
		$hovered_source_meta = source_meta;
	};
	const on_pointer_leave = () => {
		hovering = false;
		if ($hovered_source_meta === source_meta) $hovered_source_meta = null;
	};

	// TODO probably want to do a better data structure than this
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

	$: hovered_is_dependency = is_dependency($hovered_source_meta, source_meta);
	$: hovered_is_dependent = is_dependency(source_meta, $hovered_source_meta);
	$: deemphasized =
		$hovered_source_meta &&
		!hovering &&
		!(hovered_is_dependency || hovered_is_dependent || $hovered_source_meta === source_meta);
</script>

<div class="summary" class:deemphasized>
	<div class="dep">
		{#if hovered_is_dependency}↤{/if}
	</div>
	<div class="dep">
		{#if hovered_is_dependent}↦{/if}
	</div>
	<button
		on:pointerdown={() => (expanded = !expanded)}
		on:pointerenter={on_pointer_enter}
		on:pointerleave={on_pointer_leave}
		class:hovering
	>
		<span class="icon">{expanded_text}</span>
		<Source_Id id={source_meta.data.source_id} />
	</button>
</div>
{#if expanded}
	<pre>
      {JSON.stringify(source_meta, null, 2)}
    </pre>
	<button
		on:pointerdown={() => (expanded = !expanded)}
		on:pointerenter={on_pointer_enter}
		on:pointerleave={on_pointer_leave}
	>
		{expanded_text}
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
