<script lang="ts">
	import '@ryanatkn/moss/style.css';
	import '@ryanatkn/moss/theme.css';
	import '$routes/moss.css';

	import Themed from '@ryanatkn/fuz/Themed.svelte';
	import type {Snippet} from 'svelte';
	import {Pkg, pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	import {package_json, src_json} from './package.ts';

	// TODO add website, rewriting the markdown docs as Svelte

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	pkg_context.set(new Pkg(package_json, src_json));
</script>

<svelte:head>
	<title>@ryanatkn/gro</title>
</svelte:head>

<Themed>
	{@render children()}
</Themed>
