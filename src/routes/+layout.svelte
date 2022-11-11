<script lang="ts">
	import '@feltcoop/felt/ui/style.css';
	import {setDevmode} from '@feltcoop/felt/ui/devmode.js';
	import DevmodeControls from '@feltcoop/felt/ui/DevmodeControls.svelte';

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
