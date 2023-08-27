<script lang="ts">
	// make sure TypeScript works
	type A = 'gro';
	const name: A = 'gro';
</script>

<svelte:head>
	<link rel="shortcut icon" href="/favicon.png" />
</svelte:head>

<main>
	<h1>{name}</h1>
	<slot />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
