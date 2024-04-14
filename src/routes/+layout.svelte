<script lang="ts">
	import '@ryanatkn/moss/style.css';
	import '@ryanatkn/moss/theme.css';

	import Themed from '@ryanatkn/fuz/Themed.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const {children}:Props = $props();
</script>

<svelte:head>
	<title>@ryanatkn/gro</title>
</svelte:head>

<Themed>
	{@render children()}
</Themed>
