<script lang="ts">
	import '@fuz.dev/fuz/style.css';
	import '@fuz.dev/fuz/theme.css';

	import Themed from '@fuz.dev/fuz/Themed.svelte';
</script>

<svelte:head>
	<title>@grogarden/gro</title>
</svelte:head>

<Themed>
	<slot />
</Themed>
