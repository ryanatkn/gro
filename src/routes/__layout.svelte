<script lang="ts">
	import '@feltcoop/felt/ui/style.css';
	import '$lib/app/style.css';
	import {setDevmode} from '@feltcoop/felt/ui/devmode.js';
	import Devmode from '@feltcoop/felt/ui/Devmode.svelte';
	// import LinkPath from '@feltcoop/felt/ui/LinkPath.svelte';

	const devmode = setDevmode(false);
</script>

<svelte:head>
	<link rel="shortcut icon" href="/favicon.png" />
</svelte:head>

<main>
	<!-- <LinkPath path={$page.path} selectedPath={$page.path}>
		{#if $page.path === '/'}
			<a href="/" class="selected">Felt.dev</a>
		{:else}
			<a href="/" class="heart">{greenheart}</a>
		{/if}
	</LinkPath> -->
	<slot />
</main>

<Devmode {devmode} />

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
