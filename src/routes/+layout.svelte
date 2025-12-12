<script lang="ts">
	import '@fuzdev/fuz_css/style.css';
	import '@fuzdev/fuz_css/theme.css';
	import '$routes/fuz.css';

	import Themed from '@fuzdev/fuz_ui/Themed.svelte';
	import type {Snippet} from 'svelte';
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';

	import {library_json} from './library.js';

	// TODO add website, rewriting the markdown docs as Svelte

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	library_context.set(new Library(library_json));
</script>

<svelte:head>
	<title>@ryanatkn/gro</title>
</svelte:head>

<Themed>
	{@render children()}
</Themed>
