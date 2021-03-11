<script>
	export let sourceMeta;
	export let selectedSourceMeta;
	export let hoveredSourceMeta;

	// this allows you to default stuff to e.g. the selected if there's no hovered
	$: activeSourceMeta = $hoveredSourceMeta || $selectedSourceMeta;
	$: active = $hoveredSourceMeta ? hovered : selected;

	$: hovered = sourceMeta === $hoveredSourceMeta;
	$: selected = sourceMeta === $selectedSourceMeta;

	const onPointerEnter = (e) => {
		$hoveredSourceMeta = sourceMeta;
	};
	const onPointerLeave = (e) => {
		if ($hoveredSourceMeta === sourceMeta) $hoveredSourceMeta = null;
	};

	// TODO need a better data structure for this
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

	$: activeIsDependency = isDependency(activeSourceMeta, sourceMeta);
	$: activeIsDependent = isDependency(sourceMeta, activeSourceMeta);
	$: emphasized = activeIsDependency || activeIsDependent || active;
	$: deemphasized = activeSourceMeta && !emphasized;
</script>

<div class="summary" class:deemphasized class:emphasized>
	<div class="dep">
		{#if activeIsDependency}↤{/if}
	</div>
	<div class="dep">
		{#if activeIsDependent}↦{/if}
	</div>
	<button
		on:click={() => ($selectedSourceMeta = sourceMeta)}
		on:pointerenter={onPointerEnter}
		on:pointerleave={onPointerLeave}
		class:hovered
		class:selected
	>
		{sourceMeta.data.sourceId}
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
