<script lang="ts">
	import '@feltcoop/felt/style.css';
	import {setDevmode} from '@feltcoop/felt/devmode.js';
	import DevmodeControls from '@feltcoop/felt/DevmodeControls.svelte';

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
