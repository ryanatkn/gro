<script>
	import SourceId from './SourceId.svelte';

	export let sourceMeta;
	export let hoveredSourceMeta;

	let expanded = false;
	$: expandedText = expanded ? '–' : '+';

	let hovering = false;

	const onPointerEnter = (e) => {
		hovering = true;
		$hoveredSourceMeta = sourceMeta;
	};
	const onPointerLeave = (e) => {
		hovering = false;
		if ($hoveredSourceMeta === sourceMeta) $hoveredSourceMeta = null;
	};

	// TODO probably want to do a better data structure than this
	const isDependency = (dependency, dependent) =>
		dependent &&
		dependency &&
		dependent !== dependency &&
		// omg this is a big O WTF
		dependent.data.builds.find((build1) =>
			build1.dependencies?.find((d) =>
				dependency.data.builds.find((build2) => build2.id === d.buildId),
			),
		);

	$: hoveredIsDependency = isDependency($hoveredSourceMeta, sourceMeta);
	$: hoveredIsDependent = isDependency(sourceMeta, $hoveredSourceMeta);
	$: deemphasized =
		$hoveredSourceMeta &&
		!hovering &&
		!(hoveredIsDependency || hoveredIsDependent || $hoveredSourceMeta === sourceMeta);
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
		{expandedText}
		<SourceId id={sourceMeta.data.sourceId} />
	</button>
</div>
{#if expanded}
	<pre>
      {JSON.stringify(sourceMeta, null, 2)}
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
</style>
