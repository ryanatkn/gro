<script lang="ts">
	import {DEV} from 'esm-env';
	import type {Snippet} from 'svelte';

	interface Props {
		children: Snippet;
	}

	const {children}: Props = $props();

	/*
   
  TODO

  - generate prompts with a gui referencing local files
    - use the Filer to show local dirs


  */
</script>

{#if DEV}
	{@render children()}
{:else}
	gro gui is not available in production
{/if}
