<script lang="ts">
	import '@feltjs/felt-ui/style.css';
	import {setDevmode} from '@feltjs/felt-ui/devmode.js';
	import DevmodeControls from '@feltjs/felt-ui/DevmodeControls.svelte';

	const devmode = setDevmode(false);
</script>

<svelte:head>
	<link rel="shortcut icon" href="/favicon.png" />
</svelte:head>

<main>
	<slot />
</main>

<DevmodeControls {devmode} />

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
