<script lang="ts">
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

{@render children()}
gui layout
