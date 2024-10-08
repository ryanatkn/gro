<script lang="ts">
	import '@ryanatkn/moss/style.css';
	import '@ryanatkn/moss/theme.css';
	import '$routes/moss.css'; // TODO this is not being generated because of an issue with gro self imports (moss depends on it), see `gro.config.ts`

	import Themed from '@ryanatkn/fuz/Themed.svelte';
	import type {Snippet} from 'svelte';

	interface Props {
		children: Snippet;
	}

	const {children}: Props = $props();
</script>

<svelte:head>
	<title>@ryanatkn/gro</title>
</svelte:head>

<Themed>
	{@render children()}
</Themed>
